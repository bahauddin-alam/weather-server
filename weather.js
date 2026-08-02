require("dotenv").config();
const { DateTime } = require("luxon");
const fastify = require("fastify")({ logger: true });

// Allow the frontend (served from a different origin/port, e.g. Live Server on 5501)
// to read responses from this API (running on port 3000).
fastify.register(require("@fastify/cors"), {
  origin: true, // reflects the request's Origin header — fine for local dev
});

// Env validation
// Paste your own OpenWeather API key into a .env file as OPENWEATHER_API_KEY=xxxx
// (see .env.example). Never hardcode the key here — .env is gitignored.
const apiKey = process.env.OPENWEATHER_API_KEY;
if (!apiKey) {
  console.error("Missing OPENWEATHER_API_KEY environment variable");
  process.exit(1);
}

// Turnstile secret — set TURNSTILE_SECRET in your .env (never hardcode it).
const turnstileSecret = process.env.TURNSTILE_SECRET;
if (!turnstileSecret) {
  console.error("Missing TURNSTILE_SECRET environment variable");
  process.exit(1);
}

// Canonical Cloudflare Turnstile siteverify call. Browser -> this backend ->
// siteverify; the browser never calls Cloudflare directly for verification.
async function verifyTurnstile(token, remoteIp) {
  if (!token) return false;
  let result;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: turnstileSecret,
        response: token,
        remoteip: remoteIp || "",
      }),
    });
    if (!r.ok) return false;
    result = await r.json();
  } catch (err) {
    // Network error or non-JSON body from siteverify — fail closed.
    return false;
  }
  return result.success === true;
}

const port = process.env.PORT || 3000;

const VALID_UNITS = {
  metric: "°C",
  imperial: "°F",
  standard: "K",
};

function formatOffset(offsetSeconds) {
  const sign = offsetSeconds >= 0 ? "+" : "-";
  const abs = Math.abs(offsetSeconds);
  const h = String(Math.floor(abs / 3600)).padStart(2, "0");
  const m = String(Math.floor((abs % 3600) / 60)).padStart(2, "0");
  return `${sign}${h}:${m} UTC`;
}

// Format a unix (seconds) timestamp as a local clock time for a given UTC offset (seconds)
function toLocal(unixSeconds, offsetSeconds, fmt = "EEE, dd MMM yyyy hh:mm:ss a") {
  if (unixSeconds === undefined || unixSeconds === null) return null;
  return DateTime.fromSeconds(unixSeconds, { zone: "utc" })
    .plus({ seconds: offsetSeconds })
    .toFormat(fmt);
}

// Builds the full response payload: every field OpenWeather returned (spread as-is)
// plus a handful of derived, display-friendly conveniences.
function buildPayload(data, units) {
  const offset = data.timezone ?? 0;
  return {
    ...data, // coord, weather[], base, main, visibility, wind, clouds, rain, snow, dt, sys, timezone, id, name, cod — untouched
    units,
    unitSymbol: VALID_UNITS[units],
    utcOffset: formatOffset(offset),
    localTime: DateTime.utc().plus({ seconds: offset }).toFormat("EEE, dd MMM yyyy hh:mm:ss a"),
    dtLocal: toLocal(data.dt, offset),
    sunriseLocal: toLocal(data.sys?.sunrise, offset, "hh:mm:ss a"),
    sunsetLocal: toLocal(data.sys?.sunset, offset, "hh:mm:ss a"),
  };
}

// in-memory cache for returned weather data (60s TTL) so we dont hammer the openweather endpoint for the same city every second if user has gone crazy.

const cache = new Map();
const CACHE_TTL_MS = 60_000;

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

// Health check to know if server is running as expected or not
fastify.get("/health", async () => ({ status: "ok" }));

// Route 1 - /weather - to fetch the weather from openweather
// POST (not GET) because the request body carries the Turnstile token.
fastify.post("/api/weather", async function (request, reply) {
  const city = request.query.city;
  const units = (request.query.units || "metric").toLowerCase();
  const turnstileToken = request.body?.["cf-turnstile-response"];

  if (!city) {
    return reply.code(400).send({ error: "city query parameter is required" });
  }
  if (city.length > 100) {
    return reply.code(400).send({ error: "city name too long" });
  }
  if (!VALID_UNITS[units]) {
    return reply.code(400).send({
      error: `Invalid units "${units}". Must be one of: metric, imperial, standard`,
    });
  }

  // Verify the human before doing anything else — gate, don't replace,
  // the existing logic below stays exactly the same on success.
  const remoteIp = request.headers["x-forwarded-for"] || request.ip;
  const verified = await verifyTurnstile(turnstileToken, remoteIp);
  if (!verified) {
    return reply.code(403).send({ error: "Verification failed. Please try again." });
  }

  const cacheKey = `${city.trim().toLowerCase()}:${units}`;

  // Check cache — raw OpenWeather data is cached; local-time strings are
  // recomputed fresh on every request even on a cache hit.
  const cachedData = getCached(cacheKey);
  if (cachedData) {
    return buildPayload(cachedData, units);
  }

  const url =
    "https://api.openweathermap.org/data/2.5/weather?q=" +
    encodeURIComponent(city) +
    "&appid=" +
    apiKey +
    "&units=" +
    units;

  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    fastify.log.error({ err }, "Failed to reach weather API");
    return reply.code(502).send({ error: "Could not reach weather service" });
  }

  // Normalize upstream errors instead of sending raw upstream errors
  if (!response.ok) {
    fastify.log.warn(
      { status: response.status, city },
      "Weather API returned error",
    );
    const statusMap = {
      404: "City not found",
      401: "Weather service authentication failed",
      429: "Weather service rate limit reached",
    };
    const msg = statusMap[response.status] || "Weather service error";
    return reply.code(response.status === 404 ? 404 : 502).send({ error: msg });
  }

  const data = await response.json();

  if (!data.main || !data.name) {
    return reply
      .code(502)
      .send({ error: "Unexpected response from weather API" });
  }

  // Cache the raw OpenWeather response (everything, untouched)
  setCache(cacheKey, data);

  return buildPayload(data, units);
});

// Graceful shutdown
const shutdown = async (signal) => {
  fastify.log.info(`Received ${signal}, shutting down gracefully`);
  await fastify.close();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Start server
const start = async () => {
  try {
    await fastify.listen({ port, host: "0.0.0.0" });
    fastify.log.info(`Server running on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

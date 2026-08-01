require("dotenv").config();
const { DateTime } = require("luxon");
const fastify = require("fastify")({ logger: true });

fastify.register(require("@fastify/cors"), { origin: true });

const apiKey = process.env.OPENWEATHER_API_KEY;
if (!apiKey) {
  console.error("Missing OPENWEATHER_API_KEY environment variable");
  process.exit(1);
}

const port = Number(process.env.PORT) || 3000;

const VALID_UNITS = { metric: "°C", imperial: "°F", standard: "K" };
const TIME_FORMAT = "EEE, dd MMM yyyy hh:mm:ss a";

function formatOffset(offsetSeconds) {
  const sign = offsetSeconds >= 0 ? "+" : "-";
  const abs = Math.abs(offsetSeconds);
  const h = String(Math.floor(abs / 3600)).padStart(2, "0");
  const m = String(Math.floor((abs % 3600) / 60)).padStart(2, "0");
  return `${sign}${h}:${m} UTC`;
}

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

function buildResponse(weatherData, units, showCoords) {
  const localTime = DateTime.utc()
    .plus({ seconds: weatherData.timezone })
    .toFormat(TIME_FORMAT);

  return {
    city: weatherData.city,
    temp: `${weatherData.temp} ${VALID_UNITS[units]}`,
    description: weatherData.description,
    timezone: formatOffset(weatherData.timezone),
    "local-time": localTime,
    ...(showCoords && {
      coordinates: { lat: weatherData.lat, lon: weatherData.lon },
    }),
  };
}

fastify.get("/", async () => ({
  message: "Weather API is running",
  endpoints: { health: "/health", weather: "/api/weather?city=London" },
}));

fastify.get("/health", async () => ({ status: "ok" }));

fastify.get("/api/weather", async function (request, reply) {
  const rawCity = request.query.city;
  const city = typeof rawCity === "string" ? rawCity.trim() : "";
  const units = (request.query.units || "metric").toLowerCase();
  const showCoords = request.query.coords === "true";

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

  const cacheKey = `${city.toLowerCase()}:${units}`;

  const cached = getCached(cacheKey);
  if (cached) {
    return buildResponse(cached, units, showCoords);
  }

  const url =
    "https://api.openweathermap.org/data/2.5/weather?q=" +
    encodeURIComponent(city) +
    "&appid=" +
    apiKey +
    "&units=" +
    units;

  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (err) {
    fastify.log.error({ err }, "Failed to reach weather API");
    return reply.code(502).send({ error: "Could not reach weather service" });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const statusMap = {
      404: "City not found",
      401: "Weather service authentication failed",
      429: "Weather service rate limit reached",
    };
    const msg = statusMap[response.status] || "Weather service error";

    if (!statusMap[response.status]) {
      const body = await response.text().catch(() => "");
      fastify.log.error(
        { status: response.status, body },
        "Unexpected weather API error"
      );
    }

    return reply.code(response.status === 404 ? 404 : 502).send({ error: msg });
  }

  const data = await response.json();

  if (!data.main || !data.name) {
    return reply.code(502).send({ error: "Unexpected response from weather API" });
  }

  const weatherData = {
    city: data.name,
    temp: data.main.temp,
    description: data.weather?.[0]?.description || "N/A",
    timezone: data.timezone,
    lat: data.coord.lat,
    lon: data.coord.lon,
  };

  setCache(cacheKey, weatherData);

  return buildResponse(weatherData, units, showCoords);
});

const shutdown = async (signal) => {
  fastify.log.info(`Received ${signal}, shutting down gracefully`);
  await fastify.close();
  process.exit(0);
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

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

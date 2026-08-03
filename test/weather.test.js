const test = require("node:test");
const assert = require("node:assert/strict");

process.env.OPENWEATHER_API_KEY ||= "test-weather-key";
process.env.TURNSTILE_SECRET ||= "test-turnstile-secret";

const { fastify } = require("../weather");

test.after(async () => {
  await fastify.close();
});

test("health endpoint reports a ready server", async () => {
  const response = await fastify.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });
});

test("weather endpoint rejects a missing city before verification", async () => {
  const response = await fastify.inject({ method: "POST", url: "/api/weather" });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "city query parameter is required");
});

test("weather endpoint rejects unsupported units", async () => {
  const response = await fastify.inject({
    method: "POST",
    url: "/api/weather?city=Delhi&units=rankine",
  });
  assert.equal(response.statusCode, 400);
  assert.match(response.json().error, /Invalid units/);
});

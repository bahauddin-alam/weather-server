require('dotenv').config() // Loads variables from .env instead of hard coding it in the code itself
const { DateTime } = require('luxon') // Timezone + formatting
const fastify = require('fastify')({ logger: true }) // fastify has inbuilt logging we are using that. 

// Env validation
const apiKey = process.env.OPENWEATHER_API_KEY
if (!apiKey) {
  console.error('Missing OPENWEATHER_API_KEY environment variable')
  process.exit(1)
}

const port = process.env.PORT || 3000

// in-memory cache for returned weather data (60s TTL) so we dont hammer the openweather endpoint for the same city every second if user has gone crazy.

const cache = new Map()
const CACHE_TTL_MS = 60_000

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null

  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }

  return entry.data
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() })
}

// Health check to know if server is running as expected or not
fastify.get('/health', async () => ({ status: 'ok' }))

// Route 1 - /weather - to fetch the weather from openweather

fastify.get('/weather', async function (request, reply) {
  const city = request.query.city

  if (!city) {
    return reply.code(400).send({ error: 'city query parameter is required' })
  }

  if (city.length > 100) {
    return reply.code(400).send({ error: 'city name too long' })
  }

  const cacheKey = city.trim().toLowerCase()

  // Check cache
  const cached = getCached(cacheKey)
  if (cached) {
    const localTime = DateTime.utc()
      .plus({ seconds: cached.timezone })
      .toFormat('EEE, dd MMM yyyy hh:mm:ss a')

    return {
      city: cached.city,
      temp: cached.temp,
      'local-time': localTime,
    }
  }

  const url =
    'https://api.openweathermap.org/data/2.5/weather?q=' +
    encodeURIComponent(city) +
    '&appid=' + apiKey +
    '&units=metric'

  let response
  try {
    response = await fetch(url)
  } catch (err) {
    fastify.log.error({ err }, 'Failed to reach weather API')
    return reply.code(502).send({ error: 'Could not reach weather service' })
  }

    // Normalize upstream errors instead of sending raw upstream errors

  if (!response.ok) {
    fastify.log.warn({ status: response.status, city }, 'Weather API returned error')

    const statusMap = {
      404: 'City not found',
      401: 'Weather service authentication failed',
      429: 'Weather service rate limit reached',
    }

    const msg = statusMap[response.status] || 'Weather service error'
    return reply.code(response.status === 404 ? 404 : 502).send({ error: msg })
  }

  const data = await response.json()

  if (!data.main || !data.name) {
    return reply.code(502).send({ error: 'Unexpected response from weather API' })
  }
  
  // Cache weather data

  const weatherData = {
    city: data.name,
    temp: data.main.temp,
    timezone: data.timezone,
  }

  setCache(cacheKey, weatherData)

  const localTime = DateTime.utc()
    .plus({ seconds: weatherData.timezone })
    .toFormat('EEE, dd MMM yyyy hh:mm a')

  return {
    city: weatherData.city,
    temp: weatherData.temp,
    'local-time': localTime,
  }
})

// Graceful shutdown
const shutdown = async (signal) => {
  fastify.log.info(`Received ${signal}, shutting down gracefully`)
  await fastify.close()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Start server
const start = async () => {
  try {
    await fastify.listen({ port, host: '0.0.0.0' })
    fastify.log.error(err)
    process.exit(1)
  }
}

start()

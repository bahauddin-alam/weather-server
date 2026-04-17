require('dotenv').config()

const fastify = require('fastify')()

const apiKey = process.env.WEATHER_API_KEY

fastify.get('/weather', async function(request, reply) {

    const city = request.query.city

    if (!city || city.trim() === '') {
        return reply.code(400).send({ error: 'Please enter a valid city name' })
    }

    const url = "https://api.openweathermap.org/data/2.5/weather?q=" 
        + encodeURIComponent(city) 
        + "&appid=" + apiKey 
        + "&units=metric"

    const response = await fetch(url)

    if (!response.ok) {
        return reply.code(404).send({ error: 'City not found' })
    }

    const data = await response.json()

    return reply.send({
        city: data.name,
        temp: data.main.temp,
        time: new Date().toLocaleString()
    })

})

fastify.listen({ port: 3000 }, function(error) {
    if (error) throw error
    console.log('Server running at http://localhost:3000')
})
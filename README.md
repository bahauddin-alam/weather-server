# Weather Server

A simple Node.js API that returns the current temperature and local time for a city using the OpenWeather API.

## Tech Stack

* **Node.js**
* **Fastify** – web framework
* **Luxon** – date and time formatting
* **dotenv** – environment variable management
* **OpenWeather API** – weather data source

## Features

* Get weather by city name
* Returns the current local time of the city
* 60-second in-memory cache to avoid repeated API calls
* Health check endpoint

## Requirements

* Node.js 18+
* OpenWeather API key

## Setup

1. Clone the repository

```
git clone <repo-url>
cd <repo-folder>
```

2. Install dependencies

```
npm install
```

3. Create a `.env` file

```
OPENWEATHER_API_KEY=your_api_key_here
```

You can get a free API key from https://openweathermap.org/api

## Run the server

```
node weather.js
```

The server will start on:

```
http://localhost:3000
```

## API Endpoints

### Health Check

```
GET /health
```

Response

```
{
  "status": "ok"
}
```

### Get Weather

```
GET /api/weather?city=<city-name>
```

Example

```
GET /api/weather?city=Delhi
```

Example Response

```
{
  "city": "Delhi",
  "temp": 37.05,
  "local-time": "Fri, 17 Apr 2026 01:30:12 PM"
}
```


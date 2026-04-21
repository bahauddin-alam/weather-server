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
* Returns the UTC timezone offset of the city
* Optional coordinates (latitude & longitude) in the response
* Unit system selection (metric, imperial, standard)
* 60-second in-memory cache to avoid repeated API calls per city + unit combination
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
```json
{
  "status": "ok"
}
```

### Get Weather
```
GET /api/weather?city=<city-name>&units=<unit>&coords=<true|false>
```

#### Query Parameters
| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `city` | Yes | — | Name of the city |
| `units` | No | `metric` | `metric` (°C), `imperial` (°F), `standard` (K) |
| `coords` | No | `false` | Pass `true` to include latitude & longitude |

#### Examples

Basic request
```
GET /api/weather?city=Delhi
```
```json
{
  "city": "Delhi",
  "temp": "37.05 °C",
  "timezone": "+05:30 UTC",
  "local-time": "Fri, 18 Apr 2026 01:58 PM"
}
```

With imperial units
```
GET /api/weather?city=Delhi&units=imperial
```
```json
{
  "city": "Delhi",
  "temp": "98.69 °F",
  "timezone": "+05:30 UTC",
  "local-time": "Fri, 18 Apr 2026 01:58 PM"
}
```

With coordinates
```
GET /api/weather?city=Delhi&units=metric&coords=true
```
```json
{
  "city": "Delhi",
  "temp": "37.05 °C",
  "timezone": "+05:30 UTC",
  "local-time": "Fri, 18 Apr 2026 01:58 PM",
  "coordinates": {
    "lat": 28.6519,
    "lon": 77.2315
  }
}
```

# Weather Station

A Fastify weather API and browser dashboard backed by OpenWeather and Cloudflare Turnstile.

## Requirements

- Node.js 18 or newer
- An OpenWeather API key
- A Cloudflare Turnstile site key and secret configured for the deployed origins

## Setup

```sh
npm install
cp .env.example .env
```

Set the values in `.env`:

| Variable | Purpose |
| --- | --- |
| `OPENWEATHER_API_KEY` | Server-only OpenWeather credential |
| `TURNSTILE_SECRET` | Server-only Turnstile verification secret |
| `PORT` | Listening port, default `3000` |
| `CORS_ORIGIN` | Comma-separated allowed browser origins |

The public Turnstile site key belongs in `public/client.js`. It is safe to expose; the secret must remain in `.env`.

## Run

```sh
npm start
```

The dashboard is served at `http://localhost:3000`. For separate local frontend hosting, set `CORS_ORIGIN` to that frontend origin and use the configured local API base in the browser.

## Tailwind

Tailwind is compiled before deployment; it is not loaded as a browser JIT compiler.

```sh
npm run build:css
npm run watch:css
```

The input is `public/tailwind-input.css`, the scanned templates are `public/**/*.html` and `public/**/*.js`, and the generated file is `public/tailwind-output.css`.

## API

### `GET /health`

Returns `{ "status": "ok" }`.

### `POST /api/weather?city=Delhi&units=metric`

The request body must contain a successful Turnstile token:

```json
{ "cf-turnstile-response": "token-from-cloudflare" }
```

`units` accepts `metric`, `imperial`, or `standard`; it defaults to `metric`. The endpoint verifies Turnstile server-side before checking the cache or calling OpenWeather. Successful weather responses retain the provider data and add local-time/unit fields. Weather data is cached in memory for 60 seconds per city and unit.

## Verification

```sh
npm run build:css
npm test
node --check weather.js
node --check public/client.js
```

`npm audit` requires registry access and should be run in CI or another network-enabled environment.

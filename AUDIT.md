# Repository Audit

Date: 2026-08-04

## Scope

The audit covered the Fastify server, browser client, HTML/CSS/Tailwind setup, package scripts, environment documentation, API documentation, and repository contents. External API credentials and live Cloudflare/OpenWeather behavior were not available for an end-to-end request test.

## Findings and fixes

### Critical/request flow

- The UI submitted `POST /api/weather`, while the README documented `GET /api/weather` and a response shape that the server did not return. The README now documents the actual POST contract and Turnstile body.
- Turnstile was rendered and removed on every submission. The client now renders managed mode with `appearance: "interaction-only"` and `execution: "execute"`, so normal checks remain invisible and an interactive widget appears only when Cloudflare requires it.
- The submit button could be clicked repeatedly while verification or the weather request was in flight. A single busy-state guard now disables the button and city input until the operation completes, including verification failures.
- Turnstile script loading was assumed to be complete. The client now waits up to ten seconds for the async script and reports a useful error.
- Tokens are single-use. The widget is removed in the request cleanup path so expired/spent tokens are not reused.

### Server correctness and resilience

- City input was not trimmed before validation or use. The server now normalizes it before checking and caching.
- Invalid JSON from OpenWeather could escape as an unhandled route failure. It now returns a controlled `502` response and logs the provider failure.
- An unused response builder described an older, incompatible API shape. It was removed so one response contract remains authoritative.
- The server trusted arbitrary `x-forwarded-for` input for Turnstile verification. It now uses Fastify's request IP instead of accepting a client-controlled header.
- The API exposed arbitrary origins with `origin: true`. CORS is now restricted to `CORS_ORIGIN` (defaulting to the local development frontend) and only the required methods.
- Basic `nosniff`, frame, and referrer security headers are now added to responses.
- Invalid ports are rejected at startup with a clear message.

### Configuration and maintainability

- Required `TURNSTILE_SECRET` and optional runtime settings were missing from `.env.example`; they are now documented.
- The package had no usable start script and its test script always failed. `npm start` and a real Node test entry point are now provided.
- The server always bound a port when imported, which prevented isolated route tests. Startup is now guarded for CLI use and the health/validation routes have in-process tests.
- Tailwind now explicitly receives its config in the build command, keeping the production CSS build reproducible.
- The README now describes the compiled Tailwind workflow, setup, environment variables, API, and verification commands.
- `public/fuckyou.txt` was an unrelated, inappropriate repository artifact and was removed.

## Known limitations

- The in-memory cache is per process and is lost on restart; use a shared cache for multiple instances.
- There is no rate limiter. Turnstile reduces automated abuse, but production deployments should add route/IP rate limiting and upstream quotas.
- The browser site key is currently a source-level constant and must be changed when deploying to a different Turnstile site configuration.
- `npm audit` could not complete in the audit environment because registry DNS/network access was unavailable. Dependency advisories should be checked in CI.
- No live provider test was run because valid API credentials were not available.

## Validation performed

- `npm run build:css` completed successfully.
- `node --check weather.js` completed successfully.
- `node --check public/client.js` completed successfully.
- `npm audit --omit=dev --audit-level=moderate` was attempted but the npm registry was unreachable.

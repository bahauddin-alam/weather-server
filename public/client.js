// client.js — runs in the browser, talks to the weather.js backend (/api/weather)
//
// Note on the API key: the browser never touches it. weather.js reads it from
// a .env file server-side (OPENWEATHER_API_KEY=...) and this file only ever
// calls our own backend. That's the correct place to paste your own key —
// see .env.example — never put it here in client-side code.

// Fastify backend; in dev it runs separately (frontend on Live Server 5501,
// backend on 127.0.0.1:3000). In production, nginx proxies /api/ on this same
// domain straight through to the backend (see /etc/nginx/sites-available/
// weather-app), so the frontend just calls same-origin "/api/..." — no
// separate subdomain, DNS, or CORS needed.
const API_BASE =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:3000"
    : ""; // same origin — nginx handles routing /api/ to the backend

const els = {
  form: document.getElementById("search-form"),
  input: document.getElementById("city-input"),
  unitBtns: document.querySelectorAll(".unit-btn"),

  loading: document.getElementById("loading-state"),
  error: document.getElementById("error-banner"),
  errorMessage: document.getElementById("error-message"),
  empty: document.getElementById("empty-state"),
  dashboard: document.getElementById("dashboard"),

  accentBlob: document.getElementById("accent-blob"),

  icon: document.getElementById("weather-icon"),
  cityName: document.getElementById("city-name"),
  countryFlag: document.getElementById("country-flag"),
  countryName: document.getElementById("country-name"),
  coords: document.getElementById("stat-coords"),
  conditionDesc: document.getElementById("condition-desc"),

  tempValue: document.getElementById("temp-value"),
  tempUnit: document.getElementById("temp-unit"),
  feelsLike: document.getElementById("feels-like"),
  tempMin: document.getElementById("temp-min"),
  tempMax: document.getElementById("temp-max"),

  localTime: document.getElementById("local-time"),
  dtLocal: document.getElementById("stat-dt-local"),

  windNeedle: document.getElementById("wind-needle"),
  windSpeedCenter: document.getElementById("wind-speed-center"),
  windSpeedUnit: document.getElementById("wind-speed-unit"),
  windDirText: document.getElementById("wind-direction-text"),
  windDegText: document.getElementById("wind-deg-text"),
  windGustRow: document.getElementById("wind-gust-row"),
  windGustValue: document.getElementById("wind-gust-value"),

  humidity: document.getElementById("stat-humidity"),
  pressure: document.getElementById("stat-pressure"),
  clouds: document.getElementById("stat-clouds"),
  visibility: document.getElementById("stat-visibility"),

  cardSeaLevel: document.getElementById("card-sea-level"),
  seaLevel: document.getElementById("stat-sea-level"),
  cardGrndLevel: document.getElementById("card-grnd-level"),
  grndLevel: document.getElementById("stat-grnd-level"),

  sectionPrecip: document.getElementById("section-precip"),
  cardRain: document.getElementById("card-rain"),
  rain: document.getElementById("stat-rain"),
  cardSnow: document.getElementById("card-snow"),
  snow: document.getElementById("stat-snow"),

  sunrise: document.getElementById("stat-sunrise"),
  sunset: document.getElementById("stat-sunset"),
  utcOffset: document.getElementById("stat-utc-offset"),

  country: document.getElementById("stat-country"),
  cityId: document.getElementById("stat-city-id"),
  conditionId: document.getElementById("stat-condition-id"),
  base: document.getElementById("stat-base"),

  rawJson: document.getElementById("raw-json"),
};

const COMPASS_POINTS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

const CONDITION_ACCENTS = {
  Thunderstorm: "#818CF8",
  Drizzle: "#38BDF8",
  Rain: "#38BDF8",
  Snow: "#E0F2FE",
  Clear: "#FFB454",
  Clouds: "#94A3B8",
  Mist: "#64748B", Smoke: "#64748B", Haze: "#64748B", Dust: "#64748B",
  Fog: "#64748B", Sand: "#64748B", Ash: "#64748B", Squall: "#64748B", Tornado: "#64748B",
};

let state = {
  units: localStorage.getItem("weather:units") || "metric",
  lastCity: localStorage.getItem("weather:lastCity") || "",
};

function compassDirection(deg) {
  const index = Math.round(deg / 22.5) % 16;
  return COMPASS_POINTS[index];
}

function countryFlag(code) {
  if (!code || code.length !== 2) return "";
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function setUnitButtonsActive() {
  els.unitBtns.forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.unit === state.units));
  });
}

function showState(name) {
  els.loading.classList.toggle("hidden", name !== "loading");
  els.error.classList.toggle("hidden", name !== "error");
  els.empty.classList.toggle("hidden", name !== "empty");
  els.dashboard.classList.toggle("hidden", name !== "dashboard");
}

function optionalCard(cardEl, valueEl, value, formatter = (v) => v) {
  if (value === undefined || value === null) {
    cardEl.classList.add("hidden");
    return false;
  }
  cardEl.classList.remove("hidden");
  valueEl.textContent = formatter(value);
  return true;
}

function render(data) {
  const weather = data.weather?.[0] || {};
  const main = data.main || {};
  const wind = data.wind || {};
  const sys = data.sys || {};

  // Hero
  els.icon.src = weather.icon
    ? `https://openweathermap.org/img/wn/${weather.icon}@4x.png`
    : "";
  els.icon.alt = weather.description || "";
  els.cityName.textContent = data.name || "Unknown";
  els.countryFlag.textContent = countryFlag(sys.country);
  els.countryName.textContent = sys.country || "";
  els.coords.textContent =
    data.coord?.lat !== undefined
      ? `${data.coord.lat.toFixed(2)}°, ${data.coord.lon.toFixed(2)}°`
      : "";
  els.conditionDesc.textContent = [weather.main, weather.description]
    .filter(Boolean)
    .join(" · ");

  els.tempValue.textContent = main.temp !== undefined ? Math.round(main.temp * 10) / 10 : "--";
  els.tempUnit.textContent = data.unitSymbol || "";
  els.feelsLike.textContent =
    main.feels_like !== undefined ? `${Math.round(main.feels_like * 10) / 10}${data.unitSymbol}` : "--";
  els.tempMin.textContent = main.temp_min !== undefined ? `↓ ${Math.round(main.temp_min)}${data.unitSymbol}` : "";
  els.tempMax.textContent = main.temp_max !== undefined ? `↑ ${Math.round(main.temp_max)}${data.unitSymbol}` : "";

  els.localTime.textContent = data.localTime || "--";
  els.dtLocal.textContent = data.dtLocal || "--";

  // Wind compass
  if (wind.deg !== undefined) {
    els.windNeedle.style.transform = `rotate(${wind.deg}deg)`;
    els.windDirText.textContent = compassDirection(wind.deg);
    els.windDegText.textContent = wind.deg;
  } else {
    els.windNeedle.style.transform = "rotate(0deg)";
    els.windDirText.textContent = "--";
    els.windDegText.textContent = "--";
  }
  const speedUnit = data.units === "imperial" ? "mph" : "m/s";
  els.windSpeedCenter.textContent = wind.speed !== undefined ? wind.speed : "--";
  els.windSpeedUnit.textContent = ` ${speedUnit}`;
  if (wind.gust !== undefined) {
    els.windGustRow.classList.remove("hidden");
    els.windGustValue.textContent = `${wind.gust} ${speedUnit}`;
  } else {
    els.windGustRow.classList.add("hidden");
  }

  // Atmosphere
  els.humidity.textContent = main.humidity ?? "--";
  els.pressure.textContent = main.pressure ?? "--";
  els.clouds.textContent = data.clouds?.all ?? "--";
  els.visibility.textContent = data.visibility !== undefined ? (data.visibility / 1000).toFixed(1) : "--";

  optionalCard(els.cardSeaLevel, els.seaLevel, main.sea_level);
  optionalCard(els.cardGrndLevel, els.grndLevel, main.grnd_level);

  // Precipitation (only shown if the API actually returned rain/snow data)
  const rainVal = data.rain?.["1h"] ?? data.rain?.["3h"];
  const snowVal = data.snow?.["1h"] ?? data.snow?.["3h"];
  const hasRain = optionalCard(els.cardRain, els.rain, rainVal);
  const hasSnow = optionalCard(els.cardSnow, els.snow, snowVal);
  els.sectionPrecip.classList.toggle("hidden", !(hasRain || hasSnow));

  // Sun & time
  els.sunrise.textContent = data.sunriseLocal || "--";
  els.sunset.textContent = data.sunsetLocal || "--";
  els.utcOffset.textContent = data.utcOffset || "--";

  // Location & meta
  els.country.textContent = sys.country || "--";
  els.cityId.textContent = data.id ?? "--";
  els.conditionId.textContent = weather.id ?? "--";
  els.base.textContent = data.base || "--";

  // Ambient accent tint matches current conditions
  const accent = CONDITION_ACCENTS[weather.main] || "#FFB454";
  els.accentBlob.style.backgroundColor = `${accent}4D`; // ~30% alpha

  // Raw dump, for total transparency
  els.rawJson.textContent = JSON.stringify(data, null, 2);
}

async function getWeather(city) {
  if (!city) {
    els.errorMessage.textContent = "Please enter a city name.";
    showState("error");
    return;
  }

  // Turnstile tokens are single-use — grab whatever's currently rendered.
  const turnstileToken = window.turnstile?.getResponse();
  if (!turnstileToken) {
    els.errorMessage.textContent = "Please complete the verification check.";
    showState("error");
    return;
  }

  showState("loading");

  try {
    const res = await fetch(
      `${API_BASE}/api/weather?city=${encodeURIComponent(city)}&units=${state.units}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "cf-turnstile-response": turnstileToken }),
      },
    );
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Something went wrong");
    }

    render(data);
    showState("dashboard");

    state.lastCity = city;
    localStorage.setItem("weather:lastCity", city);
  } catch (err) {
    els.errorMessage.textContent = err.message || "City not found. Please try again.";
    showState("error");
  } finally {
    // Token is redeemed after one siteverify call either way — always
    // reset so the next attempt gets a fresh token instead of being
    // rejected as timeout-or-duplicate.
    window.turnstile?.reset();
  }
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  getWeather(els.input.value.trim());
});

els.unitBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    state.units = btn.dataset.unit;
    localStorage.setItem("weather:units", state.units);
    setUnitButtonsActive();
    // Switching units re-queries the backend, which means another
    // Turnstile check. Only auto-refetch if a token is already sitting
    // there solved; otherwise just wait for the person to hit submit.
    if (state.lastCity && window.turnstile?.getResponse()) {
      getWeather(state.lastCity);
    }
  });
});

// Init — prefill the last searched city as a convenience, but never
// auto-fetch on load: Turnstile can't be solved before the page has
// rendered, so a real search always needs the person to submit the form.
setUnitButtonsActive();
if (state.lastCity) {
  els.input.value = state.lastCity;
}
showState("empty");

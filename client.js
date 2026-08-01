// client.js — runs in the browser, talks to the weather.js backend (/api/weather)

const cityInput = document.getElementById("city-input");
const getWeatherBtn = document.getElementById("get-weather-btn");
const weatherInfo = document.getElementById("weather-info");
const cityNameEl = document.getElementById("city-name");
const temperatureEl = document.getElementById("temperature");
const descriptionEl = document.getElementById("description");
const errorMessageEl = document.getElementById("error-message");

const API_BASE = "http://127.0.0.1:3000";

let isLoading = false;

async function getWeather() {
  if (isLoading) return;

  const city = cityInput.value.trim();

  weatherInfo.classList.add("hidden");
  errorMessageEl.classList.add("hidden");

  if (!city) {
    errorMessageEl.textContent = "Please enter a city name.";
    errorMessageEl.classList.remove("hidden");
    return;
  }

  isLoading = true;
  getWeatherBtn.disabled = true;

  try {
    const res = await fetch(
      `${API_BASE}/api/weather?city=${encodeURIComponent(city)}&units=metric`,
    );
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Something went wrong");
    }

    cityNameEl.textContent = data.city;
    temperatureEl.textContent = `Temperature: ${data.temp}`;
    descriptionEl.textContent = `${data.description} — Local time: ${data["local-time"]} (${data.timezone})`;

    weatherInfo.classList.remove("hidden");
  } catch (err) {
    errorMessageEl.textContent = err.message || "City not found. Please try again.";
    errorMessageEl.classList.remove("hidden");
  } finally {
    isLoading = false;
    getWeatherBtn.disabled = false;
  }
}

getWeatherBtn.addEventListener("click", getWeather);
cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") getWeather();
});

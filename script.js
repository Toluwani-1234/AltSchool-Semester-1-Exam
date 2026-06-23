// Weather App with all bonus features integrated
// Uses Open-Meteo API for live weather data, localStorage for history, and browser geolocation

// Cache all DOM elements we'll be using
// Getting them once here instead of repeatedly in functions
const txtSearch = document.querySelector("#txtSearch");
const btnSearch = document.querySelector("#btnSearch");
const loadingMessage = document.querySelector("#loading-message");
const errorMessage = document.querySelector("#error-message");
const locationDisplay = document.querySelector(".location");
const temperatureDisplay = document.querySelector(".temperature");
const weatherDescDisplay = document.querySelector(".temp-description-word");
const feelsLikeDisplay = document.querySelector(".temp-description-text");
const displayIcon = document.querySelector(".display-icon");

// Get the three stats values (humidity, wind, precipitation)
const descValues = document.querySelectorAll(".desc-value");
const humidityDisplay = descValues[0];
const windDisplay = descValues[1];
const precipDisplay = descValues[2];

// All 5 forecast cards
const forecastSlides = document.querySelectorAll(".forecast-slide");

// Temperature unit toggle buttons
const btnCelsius = document.querySelector("#btnCelsius");
const btnFahrenheit = document.querySelector("#btnFahrenheit");

// Search history section and buttons container
const historyButtons = document.querySelector("#historyButtons");
const searchHistory = document.querySelector("#searchHistory");

// Keep track of what we're displaying
let currentWeatherData = null;
let currentCoordinates = null;
let currentUnit = "C"; // User can switch between C and F
const HISTORY_KEY = "weatherAppHistory";
const MAX_HISTORY_ITEMS = 5;

// Maps WMO weather codes to descriptions that make sense
// The API gives us numbers like 0, 1, 61, etc. - we need to translate those
function getWeatherDescription(code) {
  const weatherCodes = {
    0: "Clear Sky",
    1: "Mostly Clear",
    2: "Partly Cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Foggy",
    51: "Light Drizzle",
    53: "Moderate Drizzle",
    55: "Dense Drizzle",
    56: "Light Freezing Drizzle",
    57: "Dense Freezing Drizzle",
    61: "Slight Rain",
    63: "Moderate Rain",
    65: "Heavy Rain",
    66: "Light Freezing Rain",
    67: "Heavy Freezing Rain",
    71: "Slight Snow",
    73: "Moderate Snow",
    75: "Heavy Snow",
    77: "Snow Grains",
    80: "Slight Rain Showers",
    81: "Moderate Rain Showers",
    82: "Violent Rain Showers",
    85: "Slight Snow Showers",
    86: "Heavy Snow Showers",
    95: "Thunderstorm",
    96: "Thunderstorm with Slight Hail",
    99: "Thunderstorm with Heavy Hail",
  };

  return weatherCodes[code] || "Unknown";
}

// Takes a weather code and returns a fitting emoji
// Makes the app look nicer than just text descriptions
function getWeatherEmoji(code) {
  if (code === 0) return "☀️";
  if (code === 1 || code === 2 || code === 3) return "⛅";
  if (code === 45 || code === 48) return "🌫️";
  if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57)
    return "🌦️";
  if (
    code === 61 ||
    code === 63 ||
    code === 65 ||
    code === 66 ||
    code === 67 ||
    code === 80 ||
    code === 81 ||
    code === 82
  )
    return "🌧️";
  if (
    code === 71 ||
    code === 73 ||
    code === 75 ||
    code === 77 ||
    code === 85 ||
    code === 86
  )
    return "❄️";
  if (code === 95 || code === 96 || code === 99) return "⛈️";
  return "🌡️";
}

// Temperature conversion - simple formula
function celsiusToFahrenheit(celsius) {
  return (celsius * 9) / 5 + 32;
}

// Switch between C and F without fetching new data
// Just convert what we already have and redraw the UI
function switchTemperatureUnit(unit) {
  if (!currentWeatherData) return;

  currentUnit = unit;
  updateUnitButtonStates();
  displayCurrentWeather(
    currentWeatherData,
    currentCoordinates.name,
    currentCoordinates.country,
  );
  displayForecast(currentWeatherData);
}

// Highlight which temperature unit button is active
function updateUnitButtonStates() {
  btnCelsius.classList.toggle("active", currentUnit === "C");
  btnFahrenheit.classList.toggle("active", currentUnit === "F");
}

// Show or hide the loading message while fetching data
function showLoading(isLoading) {
  if (isLoading) {
    loadingMessage.textContent = "Loading weather data...";
    loadingMessage.style.display = "block";
  } else {
    loadingMessage.style.display = "none";
  }
}

// Display error messages to the user
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = "block";
}

// Clear error messages
function clearError() {
  errorMessage.textContent = "";
  errorMessage.style.display = "none";
}

// Save a city to localStorage when user searches
// Also prevents duplicates and keeps the list limited to 5 items
function saveToHistory(cityName) {
  try {
    let history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];

    // If city already in history, remove it (we'll add it back to the top)
    history = history.filter(
      (city) => city.toLowerCase() !== cityName.toLowerCase(),
    );

    // Add the most recent search to the beginning
    history.unshift(cityName);

    // Only keep the 5 most recent
    history = history.slice(0, MAX_HISTORY_ITEMS);

    // Save back to browser storage
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

    // Update the display
    renderSearchHistory();
  } catch (error) {
    console.error("Error saving to history:", error);
  }
}

// Draw the search history buttons on the page
// Called whenever the history changes
function renderSearchHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];

    // Clear old buttons first
    historyButtons.innerHTML = "";

    // Don't show the section if there's no history
    if (history.length === 0) {
      searchHistory.style.display = "none";
      return;
    }

    // Show the section and add buttons for each city
    searchHistory.style.display = "block";

    history.forEach((city) => {
      const button = document.createElement("button");
      button.className = "history-button";
      button.textContent = city;
      button.type = "button";

      // Clicking a history button searches for that city
      button.addEventListener("click", () => {
        txtSearch.value = city;
        handleSearch();
      });

      historyButtons.appendChild(button);
    });
  } catch (error) {
    console.error("Error rendering history:", error);
  }
}

// Load search history on page start
function initializeSearchHistory() {
  renderSearchHistory();
}

// Use browser geolocation to get user's current location
// Auto-loads weather for their location if they allow it
function detectUserLocation() {
  if (!navigator.geolocation) {
    console.log("Geolocation not supported in this browser");
    return;
  }

  showLoading(true);

  navigator.geolocation.getCurrentPosition(
    // Success - we got their location
    async (position) => {
      try {
        const { latitude, longitude } = position.coords;

        // Fetch weather for this location
        const weatherData = await fetchWeatherData(latitude, longitude);
        currentWeatherData = weatherData;

        // Get the city name from the coordinates
        const cityInfo = await getReverseGeocode(latitude, longitude);

        currentCoordinates = {
          name: cityInfo.name,
          country: cityInfo.country,
          latitude: latitude,
          longitude: longitude,
        };

        displayCurrentWeather(weatherData, cityInfo.name, cityInfo.country);
        displayForecast(weatherData);
        saveToHistory(cityInfo.name);
        clearError();
      } catch (error) {
        showError(`Error loading location weather: ${error.message}`);
        console.error("Geolocation error:", error);
      } finally {
        showLoading(false);
      }
    },
    // Error - user denied permission or something went wrong
    (error) => {
      console.log(
        "Geolocation permission denied or unavailable:",
        error.message,
      );
      showLoading(false);
      // No need to show error - user can still search manually
    },
  );
}

// Convert coordinates back to  city name
// This is the reverse of the geocoding 'cause we have latitude/longitude, and we need the city
function getReverseGeocode(latitude, longitude) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?latitude=${latitude}&longitude=${longitude}&language=en&format=json`;

  try {
    return fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("Reverse geocoding failed");
        return response.json();
      })
      .then((data) => {
        if (data.results && data.results.length > 0) {
          const result = data.results[0];
          return {
            name: result.name,
            country: result.country || "Unknown",
          };
        }
        return { name: "Your Location", country: "Unknown" };
      })
      .catch((error) => {
        console.error("Reverse geocoding error:", error);
        return { name: "Your Location", country: "Unknown" };
      });
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return { name: "Your Location", country: "Unknown" };
  }
}

// Look up city coordinates using the geocoding API
// Takes a city name, returns latitude/longitude so we can fetch weather
function fetchCoordinates(cityName) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    cityName,
  )}&count=1&language=en&format=json`;

  return fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      // Make sure we actually found the city
      if (!data.results || data.results.length === 0) {
        throw new Error(
          `City "${cityName}" not found. Please try another search.`,
        );
      }

      const result = data.results[0];

      return {
        name: result.name,
        country: result.country || "Unknown",
        latitude: result.latitude,
        longitude: result.longitude,
      };
    })
    .catch((error) => {
      throw new Error(error.message || "Failed to fetch city coordinates");
    });
}

// Fetch actual weather data for given coordinates
// Gets current conditions and 5-day forecast
function fetchWeatherData(latitude, longitude) {
  const url =
    `https://api.open-meteo.com/v1/forecast?` +
    `latitude=${latitude}&longitude=${longitude}&` +
    `current=temperature_2m,relative_humidity_2m,weather_code,apparent_temperature,precipitation,wind_speed_10m&` +
    `daily=weather_code,temperature_2m_max,temperature_2m_min&` +
    `timezone=auto`;

  return fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }
      return response.json();
    })
    .catch((error) => {
      throw new Error(error.message || "Failed to fetch weather data");
    });
}

// Update the main weather display with current conditions
// Shows temperature, location, "feels like", and weather description
function displayCurrentWeather(weatherData, cityName, countryName) {
  const current = weatherData.current;
  const currentUnits = weatherData.current_units;

  // Get temperature in the right unit
  let temp = current.temperature_2m;
  let feelsLike = current.apparent_temperature;
  const unitSymbol = currentUnit === "F" ? "°F" : "°C";

  if (currentUnit === "F") {
    temp = celsiusToFahrenheit(temp);
    feelsLike = celsiusToFahrenheit(feelsLike);
  }

  // Update main display
  locationDisplay.textContent = `${cityName}, ${countryName}`;
  temperatureDisplay.textContent = `${Math.round(temp)}${unitSymbol}`;

  // Update description and feels-like
  const description = getWeatherDescription(current.weather_code);
  feelsLikeDisplay.textContent = `Feels like ${Math.round(feelsLike)}${unitSymbol}.`;
  weatherDescDisplay.textContent = description;

  // Add the animated weather emoji
  displayIcon.textContent = getWeatherEmoji(current.weather_code);
  displayIcon.classList.add("weather-icon-animated");

  // Update the stats row
  const windSpeedUnit = currentUnits.wind_speed_10m || "km/h";
  const precipUnit = currentUnits.precipitation || "mm";

  humidityDisplay.textContent = `${current.relative_humidity_2m}%`;
  windDisplay.textContent = `${Math.round(current.wind_speed_10m)} ${windSpeedUnit}`;
  precipDisplay.textContent = `${current.precipitation} ${precipUnit}`;
}

// Update the 5-day forecast cards
// Shows day name, emoji, and high/low temps for each day
function displayForecast(weatherData) {
  const daily = weatherData.daily;

  for (let i = 0; i < 5 && i < forecastSlides.length; i++) {
    const slide = forecastSlides[i];

    // Figure out the day name
    const date = new Date(daily.time[i]);
    let dayName;

    if (i === 0) {
      dayName = "Today";
    } else {
      dayName = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(
        date,
      );
    }

    // Get temp data for this day
    let highTemp = daily.temperature_2m_max[i];
    let lowTemp = daily.temperature_2m_min[i];

    // Convert to Fahrenheit if needed
    if (currentUnit === "F") {
      highTemp = celsiusToFahrenheit(highTemp);
      lowTemp = celsiusToFahrenheit(lowTemp);
    }

    const unitSymbol = currentUnit === "F" ? "°" : "°";

    // Update the card
    const dayElement = slide.querySelector(".forecast-day");
    const iconElement = slide.querySelector(".forecast-icon");
    const tempElement = slide.querySelector(".forecast-temperature");

    if (dayElement) dayElement.textContent = dayName;
    if (iconElement)
      iconElement.textContent = getWeatherEmoji(daily.weather_code[i]);

    if (tempElement) {
      const temps = tempElement.querySelectorAll("p");
      if (temps.length >= 2) {
        temps[0].textContent = `${Math.round(highTemp)}${unitSymbol}`;
        temps[1].textContent = `${Math.round(lowTemp)}${unitSymbol}`;
      }
    }
  }
}

// Main function - handles searching for a city and displaying weather
// This is what runs when user clicks search or presses enter
function handleSearch() {
  const searchValue = txtSearch.value.trim();

  // Don't search if the input is empty
  if (!searchValue) {
    showError("Please enter a city name.");
    return;
  }

  // Clear old errors and show loading state
  clearError();
  showLoading(true);

  // Chain of: get coords → fetch weather → display it
  fetchCoordinates(searchValue)
    .then((coordinates) => {
      currentCoordinates = coordinates;
      return fetchWeatherData(coordinates.latitude, coordinates.longitude);
    })
    .then((weatherData) => {
      currentWeatherData = weatherData;
      displayCurrentWeather(
        weatherData,
        currentCoordinates.name,
        currentCoordinates.country,
      );
      displayForecast(weatherData);
      saveToHistory(currentCoordinates.name);
      clearError();
    })
    .catch((error) => {
      showError(`Error: ${error.message}`);
      console.error("Search error:", error);
    })
    .finally(() => {
      showLoading(false);
      txtSearch.value = ""; // Clear input after search
    });
}

// Lets users press Enter to search instead of clicking the button
function handleKeyPress(event) {
  if (event.key === "Enter") {
    handleSearch();
  }
}

// Wire up the search functionality
btnSearch.addEventListener("click", handleSearch);
txtSearch.addEventListener("keypress", handleKeyPress);

// Wire up temperature unit toggle
btnCelsius.addEventListener("click", () => switchTemperatureUnit("C"));
btnFahrenheit.addEventListener("click", () => switchTemperatureUnit("F"));

// Initialize the app when page loads
function initializeApp() {
  initializeSearchHistory();
  detectUserLocation();
}

window.addEventListener("load", initializeApp);

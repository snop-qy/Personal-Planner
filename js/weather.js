/**
 * weather.js
 * Current weather and temperature on the Dashboard.
 *
 * Data comes from Open-Meteo (https://open-meteo.com) — free, no API key needed.
 * We call it with fetch(), which returns a Promise; "await" waits for the answer.
 *
 * To avoid calling the API on every page load, the last result is cached in
 * LocalStorage and reused for CACHE_MINUTES.
 */

const Weather = {
  FORECAST_URL: 'https://api.open-meteo.com/v1/forecast',
  GEOCODING_URL: 'https://geocoding-api.open-meteo.com/v1/search',
  CACHE_MINUTES: 30,
  DEFAULT_LOCATION: { name: 'Bangkok', country: 'Thailand', latitude: 13.7563, longitude: 100.5018 },

  status: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
  current: null,
  latestRequestId: 0,
  elements: {},

  /*
   * Open-Meteo describes the sky with WMO weather codes (numbers).
   * Each group of codes gets a label and one of our cute icons.
   */
  CONDITIONS: [
    { codes: [0], label: 'Clear sky', icon: 'sun', nightIcon: 'moon' },
    { codes: [1], label: 'Mostly clear', icon: 'partly', nightIcon: 'partly-night' },
    { codes: [2], label: 'Partly cloudy', icon: 'partly', nightIcon: 'partly-night' },
    { codes: [3], label: 'Cloudy', icon: 'cloud' },
    { codes: [45, 48], label: 'Foggy', icon: 'fog' },
    { codes: [51, 53, 55, 56, 57], label: 'Drizzle', icon: 'rain' },
    { codes: [61, 63, 65, 66, 67, 80, 81, 82], label: 'Rain', icon: 'rain' },
    { codes: [71, 73, 75, 77, 85, 86], label: 'Snow', icon: 'snow' },
    { codes: [95, 96, 99], label: 'Thunderstorm', icon: 'storm' },
  ],

  init() {
    this.elements = {
      card: document.getElementById('weather-card'),
      loading: document.getElementById('weather-loading'),
      error: document.getElementById('weather-error'),
      content: document.getElementById('weather-content'),
      icon: document.getElementById('weather-icon'),
      temperature: document.getElementById('weather-temp'),
      condition: document.getElementById('weather-condition'),
      location: document.getElementById('weather-location'),
      highLow: document.getElementById('weather-high-low'),
      feelsLike: document.getElementById('weather-feels'),
      humidity: document.getElementById('weather-humidity'),
      rainChance: document.getElementById('weather-rain'),
      retryButton: document.getElementById('weather-retry-btn'),
    };

    this.elements.retryButton.addEventListener('click', () => this.refresh({ force: true }));

    this.current = Storage.loadData(STORAGE_KEYS.weather, null);
    this.refresh();
    // Keep the weather fresh while the page stays open
    setInterval(() => this.refresh(), this.CACHE_MINUTES * 60 * 1000);
  },

  getLocation() {
    return Settings.get('weatherLocation') || this.DEFAULT_LOCATION;
  },

  getUnit() {
    return Settings.get('temperatureUnit') === 'fahrenheit' ? 'fahrenheit' : 'celsius';
  },

  /** The cache is only reused if it is recent AND for the same place and unit. */
  isCacheFresh(cache, location, unit) {
    if (!cache || !cache.fetchedAt) return false;
    const ageMinutes = (Date.now() - cache.fetchedAt) / 60000;
    return ageMinutes < this.CACHE_MINUTES
      && cache.unit === unit
      && cache.latitude === location.latitude
      && cache.longitude === location.longitude;
  },

  buildForecastUrl(location, unit) {
    // URLSearchParams builds "?latitude=...&longitude=..." and escapes the values for us
    const params = new URLSearchParams({
      latitude: location.latitude,
      longitude: location.longitude,
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      timezone: 'auto',
      forecast_days: 1,
      temperature_unit: unit,
    });
    return `${this.FORECAST_URL}?${params}`;
  },

  /** Download the weather and keep only the numbers we show. */
  async fetchWeather(location, unit) {
    const response = await fetch(this.buildForecastUrl(location, unit));
    if (!response.ok) {
      throw new Error(`Weather request failed (${response.status})`);
    }
    const json = await response.json();

    return {
      fetchedAt: Date.now(),
      latitude: location.latitude,
      longitude: location.longitude,
      unit,
      temperature: json.current.temperature_2m,
      feelsLike: json.current.apparent_temperature,
      humidity: json.current.relative_humidity_2m,
      code: json.current.weather_code,
      isDay: json.current.is_day === 1,
      high: json.daily.temperature_2m_max[0],
      low: json.daily.temperature_2m_min[0],
      rainChance: json.daily.precipitation_probability_max[0],
    };
  },

  async refresh({ force = false } = {}) {
    const location = this.getLocation();
    const unit = this.getUnit();

    if (!force && this.isCacheFresh(this.current, location, unit)) {
      this.status = 'ready';
      this.render();
      return;
    }

    this.status = 'loading';
    this.render();

    // If the city changes while we are still waiting, ignore the older (slower) answer
    const requestId = ++this.latestRequestId;

    try {
      const result = await this.fetchWeather(location, unit);
      if (requestId !== this.latestRequestId) return;
      this.current = result;
      Storage.saveData(STORAGE_KEYS.weather, this.current);
      this.status = 'ready';
    } catch (error) {
      if (requestId !== this.latestRequestId) return;
      console.error(error);
      // If we still have older data for the same place, show it instead of an error
      const hasOldData = this.current && this.current.latitude === location.latitude
        && this.current.longitude === location.longitude && this.current.unit === unit;
      this.status = hasOldData ? 'ready' : 'error';
    }
    this.render();
  },

  /* ---------- City search (used by Settings) ---------- */

  /** Returns a list of matching places: [{ name, country, admin1, latitude, longitude }] */
  async searchCity(query) {
    const params = new URLSearchParams({ name: query, count: 5, language: 'en', format: 'json' });
    const response = await fetch(`${this.GEOCODING_URL}?${params}`);
    if (!response.ok) {
      throw new Error(`City search failed (${response.status})`);
    }
    const json = await response.json();
    return (json.results || []).map((place) => ({
      name: place.name,
      country: place.country || '',
      admin1: place.admin1 || '',
      latitude: place.latitude,
      longitude: place.longitude,
    }));
  },

  /** Ask the browser for the device's position. Wrapped in a Promise so we can "await" it. */
  getDevicePosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Your browser does not support location.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          name: 'My location',
          country: '',
          // Round to 2 decimals (~1 km) — precise enough for weather, better for privacy
          latitude: Math.round(position.coords.latitude * 100) / 100,
          longitude: Math.round(position.coords.longitude * 100) / 100,
        }),
        () => reject(new Error('Location permission was denied.')),
        { timeout: 10000 }
      );
    });
  },

  /* ---------- Rendering ---------- */

  describe(code, isDay) {
    const condition = this.CONDITIONS.find((item) => item.codes.includes(code))
      || { label: 'Unknown', icon: 'cloud' };
    const icon = !isDay && condition.nightIcon ? condition.nightIcon : condition.icon;
    return { label: condition.label, icon };
  },

  formatTemperature(value) {
    return `${Math.round(value)}°`;
  },

  render() {
    const els = this.elements;
    const isLoading = this.status === 'loading' || this.status === 'idle';

    els.loading.hidden = !isLoading;
    els.error.hidden = this.status !== 'error';
    els.content.hidden = this.status !== 'ready';
    els.card.setAttribute('aria-busy', String(isLoading));

    if (this.status !== 'ready' || !this.current) return;

    const weather = this.current;
    const condition = this.describe(weather.code, weather.isDay);
    const unitLetter = weather.unit === 'fahrenheit' ? 'F' : 'C';
    const location = this.getLocation();

    els.icon.querySelector('use').setAttribute('href', `#wx-${condition.icon}`);
    els.temperature.textContent = `${this.formatTemperature(weather.temperature)}${unitLetter}`;
    els.condition.textContent = condition.label;
    els.location.textContent = location.name;
    els.highLow.textContent = `H ${this.formatTemperature(weather.high)} · L ${this.formatTemperature(weather.low)}`;
    els.feelsLike.textContent = this.formatTemperature(weather.feelsLike);
    els.humidity.textContent = `${Math.round(weather.humidity)}%`;
    els.rainChance.textContent = weather.rainChance === null ? '–' : `${weather.rainChance}%`;

    const updatedAt = new Date(weather.fetchedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    els.card.title = `${condition.label} in ${location.name} · updated ${updatedAt}`;
  },
};

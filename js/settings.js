/**
 * settings.js
 * User preferences and data tools (backup, restore, delete all).
 *
 * Saved as one object:
 * { name, clockFormat: "24" | "12", showSeconds, waterGoal,
 *   weatherLocation: { name, country, latitude, longitude } | null, temperatureUnit: "celsius" | "fahrenheit" }
 */

const Settings = {
  DEFAULTS: {
    name: 'Guest',
    clockFormat: '24',
    showSeconds: true,
    waterGoal: 8,
    weatherLocation: null, // null = use Weather.DEFAULT_LOCATION
    temperatureUnit: 'celsius',
  },
  MIN_WATER_GOAL: 4,
  MAX_WATER_GOAL: 12,
  BACKUP_APP_NAME: 'personal-planner',

  values: {},
  cityResults: [], // places from the last city search
  elements: {},

  init() {
    // Spread syntax: start from the defaults, then overwrite with whatever was saved
    const saved = Storage.loadData(STORAGE_KEYS.settings, {});
    this.values = { ...this.DEFAULTS, ...(saved && typeof saved === 'object' ? saved : {}) };

    this.elements = {
      profileName: document.getElementById('profile-name'),
      nameInput: document.getElementById('settings-name-input'),
      themeRadios: document.querySelectorAll('input[name="theme"]'),
      clockRadios: document.querySelectorAll('input[name="clockFormat"]'),
      secondsInput: document.getElementById('settings-seconds-input'),
      waterGoalSelect: document.getElementById('settings-water-goal'),
      exportButton: document.getElementById('settings-export-btn'),
      importInput: document.getElementById('settings-import-input'),
      dataError: document.getElementById('settings-data-error'),
      resetButton: document.getElementById('settings-reset-btn'),
      weatherCity: document.getElementById('settings-weather-city'),
      citySearchForm: document.getElementById('city-search-form'),
      citySearchInput: document.getElementById('city-search-input'),
      citySearchStatus: document.getElementById('city-search-status'),
      cityResults: document.getElementById('city-results'),
      myLocationButton: document.getElementById('use-my-location-btn'),
      unitRadios: document.querySelectorAll('input[name="temperatureUnit"]'),
    };

    this.fillWaterGoalOptions();
    this.bindEvents();
  },

  get(key) {
    return this.values[key];
  },

  update(key, value) {
    this.values[key] = value;
    Storage.saveData(STORAGE_KEYS.settings, this.values);
  },

  getDisplayName() {
    return this.values.name.trim() || this.DEFAULTS.name;
  },

  fillWaterGoalOptions() {
    for (let goal = this.MIN_WATER_GOAL; goal <= this.MAX_WATER_GOAL; goal++) {
      const option = document.createElement('option');
      option.value = goal;
      option.textContent = `${goal} glasses`;
      this.elements.waterGoalSelect.appendChild(option);
    }
  },

  bindEvents() {
    const { nameInput, themeRadios, clockRadios, secondsInput, waterGoalSelect, exportButton, importInput, resetButton } = this.elements;

    // "change" fires when the user leaves the field, so we don't save on every keystroke
    nameInput.addEventListener('change', () => {
      this.update('name', nameInput.value.trim());
      UI.showToast('Name saved.');
      App.refresh();
    });

    themeRadios.forEach((radio) => {
      radio.addEventListener('change', () => Theme.set(radio.value));
    });

    clockRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        this.update('clockFormat', radio.value);
        Clock.tick();
      });
    });

    secondsInput.addEventListener('change', () => {
      this.update('showSeconds', secondsInput.checked);
      Clock.tick();
    });

    waterGoalSelect.addEventListener('change', () => {
      const goal = Number(waterGoalSelect.value);
      this.update('waterGoal', goal);
      Water.applyGoal(DateUtils.todayKey(), goal);
      UI.showToast(`Water goal set to ${goal} glasses.`);
      App.refresh();
    });

    this.bindWeatherEvents();

    exportButton.addEventListener('click', () => this.exportBackup());
    importInput.addEventListener('change', (event) => this.handleImport(event));
    resetButton.addEventListener('click', () => this.confirmDeleteAll());
  },

  /* ---------- Weather location & unit ---------- */

  bindWeatherEvents() {
    const { citySearchForm, cityResults, myLocationButton, unitRadios } = this.elements;

    citySearchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleCitySearch();
    });

    // Event delegation: one listener for all result buttons
    cityResults.addEventListener('click', (event) => {
      const resultButton = event.target.closest('[data-index]');
      if (resultButton) {
        this.setWeatherLocation(this.cityResults[Number(resultButton.dataset.index)]);
      }
    });

    myLocationButton.addEventListener('click', () => this.handleUseMyLocation());

    unitRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        this.update('temperatureUnit', radio.value);
        Weather.refresh();
      });
    });
  },

  async handleCitySearch() {
    const { citySearchInput, citySearchStatus, cityResults } = this.elements;
    const query = citySearchInput.value.trim();
    cityResults.innerHTML = '';

    if (query.length < 2) {
      citySearchStatus.textContent = 'Type at least 2 letters.';
      return;
    }

    citySearchStatus.textContent = 'Searching…';
    try {
      this.cityResults = await Weather.searchCity(query);
    } catch (error) {
      citySearchStatus.textContent = 'Search failed. Check your internet connection.';
      return;
    }

    if (this.cityResults.length === 0) {
      citySearchStatus.textContent = `No places found for "${query}".`;
      return;
    }

    citySearchStatus.textContent = 'Choose your city:';
    this.cityResults.forEach((place, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'city-result';
      button.dataset.index = index;
      button.textContent = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
      item.appendChild(button);
      cityResults.appendChild(item);
    });
  },

  async handleUseMyLocation() {
    const { citySearchStatus, myLocationButton } = this.elements;
    citySearchStatus.textContent = 'Finding your location…';
    myLocationButton.disabled = true;

    try {
      this.setWeatherLocation(await Weather.getDevicePosition());
    } catch (error) {
      citySearchStatus.textContent = `${error.message} You can search for a city instead.`;
    } finally {
      myLocationButton.disabled = false;
    }
  },

  setWeatherLocation(place) {
    this.update('weatherLocation', place);
    this.elements.cityResults.innerHTML = '';
    this.elements.citySearchInput.value = '';
    this.elements.citySearchStatus.textContent = '';
    UI.showToast(`Weather location set to ${place.name}.`);
    this.render();
    Weather.refresh();
  },

  getWeatherLocationLabel() {
    const location = Weather.getLocation();
    return [location.name, location.country].filter(Boolean).join(', ');
  },

  /* ---------- Backup & restore ---------- */

  /** Collect everything into one object and download it as a .json file. */
  exportBackup() {
    const backup = {
      app: this.BACKUP_APP_NAME,
      version: 2,
      exportedAt: new Date().toISOString(),
      data: {
        tasks: Storage.loadList(STORAGE_KEYS.tasks),
        water: Storage.loadList(STORAGE_KEYS.water),
        diary: Storage.loadList(STORAGE_KEYS.diary),
        settings: this.values,
        theme: Theme.current,
      },
    };

    // A Blob is a file made in memory; an <a download> link saves it to the computer
    const file = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = `personal-planner-backup-${DateUtils.todayKey()}.json`;
    link.click();
    // Free the memory once the browser has started the download
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);

    UI.showToast('Backup downloaded.');
  },

  isValidBackup(backup) {
    return Boolean(backup)
      && backup.app === this.BACKUP_APP_NAME
      && backup.data
      && Array.isArray(backup.data.tasks)
      && Array.isArray(backup.data.water)
      && Array.isArray(backup.data.diary);
  },

  async handleImport(event) {
    const file = event.target.files[0];
    event.target.value = ''; // allow choosing the same file again later
    if (!file) return;

    this.elements.dataError.hidden = true;
    let backup;
    try {
      backup = JSON.parse(await file.text());
    } catch (error) {
      backup = null;
    }

    if (!this.isValidBackup(backup)) {
      this.elements.dataError.textContent = 'This file is not a Personal Planner backup. Please choose a file made with "Download backup".';
      this.elements.dataError.hidden = false;
      return;
    }

    const confirmed = await UI.confirm({
      title: 'Restore backup?',
      message: 'This replaces ALL current tasks, diary entries and settings with the backup. This cannot be undone.',
      confirmLabel: 'Restore',
    });
    if (!confirmed) return;

    const { tasks, water, diary, settings, theme } = backup.data;
    const allSaved = [
      Storage.saveData(STORAGE_KEYS.tasks, tasks),
      Storage.saveData(STORAGE_KEYS.water, water),
      Storage.saveData(STORAGE_KEYS.diary, diary),
      Storage.saveData(STORAGE_KEYS.settings, settings || {}),
      Storage.saveData(STORAGE_KEYS.theme, theme === 'dark' ? 'dark' : 'light'),
    ].every(Boolean);

    if (!allSaved) {
      this.elements.dataError.textContent = 'Not enough browser storage to restore this backup.';
      this.elements.dataError.hidden = false;
      return;
    }
    // Reload so every module starts fresh with the restored data
    window.location.reload();
  },

  async confirmDeleteAll() {
    const confirmed = await UI.confirm({
      title: 'Delete all data?',
      message: 'Every task, diary entry, mood, water log and setting will be deleted. Download a backup first if you want to keep them.',
      confirmLabel: 'Delete everything',
    });
    if (!confirmed) return;

    Object.values(STORAGE_KEYS).forEach((key) => Storage.deleteData(key));
    window.location.hash = 'dashboard';
    window.location.reload();
  },

  /* ---------- Rendering ---------- */

  render() {
    const { profileName, nameInput, themeRadios, clockRadios, secondsInput, waterGoalSelect } = this.elements;

    profileName.textContent = this.getDisplayName();
    // Don't overwrite the box while the user is typing in it
    if (document.activeElement !== nameInput) {
      nameInput.value = this.values.name;
    }
    themeRadios.forEach((radio) => { radio.checked = radio.value === Theme.current; });
    clockRadios.forEach((radio) => { radio.checked = radio.value === this.values.clockFormat; });
    secondsInput.checked = this.values.showSeconds;
    waterGoalSelect.value = this.values.waterGoal;
    this.elements.weatherCity.textContent = this.getWeatherLocationLabel();
    this.elements.unitRadios.forEach((radio) => { radio.checked = radio.value === this.values.temperatureUnit; });
  },
};

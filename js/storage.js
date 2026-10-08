/**
 * storage.js
 * A small wrapper around the browser's LocalStorage.
 *
 * LocalStorage can only store strings, so every value is converted to JSON
 * with JSON.stringify() when saving and back with JSON.parse() when loading.
 */

const STORAGE_KEYS = {
  tasks: 'planner_tasks',
  water: 'planner_water',
  diary: 'planner_diary',
  theme: 'planner_theme',
  selectedDate: 'planner_selected_date',
  settings: 'planner_settings',
  weather: 'planner_weather', // cached weather result (not part of backups)
};

const Storage = {
  /**
   * Save any value under a key.
   * Returns true on success, false if the browser refused (e.g. storage is full).
   */
  saveData(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Could not save "${key}" to LocalStorage:`, error);
      return false;
    }
  },

  /**
   * Load a value by key. If nothing is saved yet, or the saved text is broken,
   * the fallback value is returned instead so the app never crashes on start.
   */
  loadData(key, fallback = null) {
    try {
      const savedText = localStorage.getItem(key);
      return savedText === null ? fallback : JSON.parse(savedText);
    } catch (error) {
      console.error(`Could not load "${key}" from LocalStorage:`, error);
      return fallback;
    }
  },

  /**
   * Load a value, change it with the updater function, then save it back.
   * Example: Storage.updateData('planner_tasks', tasks => [...tasks, newTask], [])
   */
  updateData(key, updater, fallback = null) {
    const currentValue = this.loadData(key, fallback);
    const updatedValue = updater(currentValue);
    return this.saveData(key, updatedValue) ? updatedValue : null;
  },

  deleteData(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Could not delete "${key}" from LocalStorage:`, error);
    }
  },

  /** Load a value that must be an array (tasks, water entries, diary entries). */
  loadList(key) {
    const savedList = this.loadData(key, []);
    return Array.isArray(savedList) ? savedList : [];
  },
};

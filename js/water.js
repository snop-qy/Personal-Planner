/**
 * water.js
 * Tracks how many glasses of water were drunk each day.
 *
 * Saved as an array with one entry per day:
 * [{ date: "2026-10-07", glasses: 5, goal: 8 }, ...]
 */

const Water = {
  DEFAULT_GOAL: 8,
  entries: [],
  elements: {},

  init() {
    this.entries = this.loadWater();
    this.elements = {
      count: document.getElementById('water-count'),
      goal: document.getElementById('water-goal'),
      glasses: document.getElementById('water-glasses'),
      progress: document.getElementById('water-progress'),
      message: document.getElementById('water-message'),
      addButton: document.getElementById('water-add-btn'),
      removeButton: document.getElementById('water-remove-btn'),
      resetButton: document.getElementById('water-reset-btn'),
    };
    this.bindEvents();
  },

  bindEvents() {
    const { addButton, removeButton, resetButton } = this.elements;
    addButton.addEventListener('click', () => this.handleAddGlass());
    removeButton.addEventListener('click', () => this.handleRemoveGlass());
    resetButton.addEventListener('click', () => this.handleReset());
  },

  /* ---------- Data ---------- */

  loadWater() {
    return Storage.loadList(STORAGE_KEYS.water);
  },

  saveWater() {
    const saved = Storage.saveData(STORAGE_KEYS.water, this.entries);
    if (!saved) {
      UI.showToast('Could not save water data. Browser storage may be full.', 'error');
    }
    return saved;
  },

  /** Always returns an entry. Days with no saved data start at 0 glasses and the goal from Settings. */
  getEntry(dateKey) {
    const savedEntry = this.entries.find((entry) => entry.date === dateKey);
    return savedEntry || { date: dateKey, glasses: 0, goal: Settings.get('waterGoal') || this.DEFAULT_GOAL };
  },

  /** Change the goal of an already-saved day (used when the goal changes in Settings). */
  applyGoal(dateKey, goal) {
    const existingIndex = this.entries.findIndex((item) => item.date === dateKey);
    if (existingIndex === -1) return;

    const entry = this.entries[existingIndex];
    this.entries[existingIndex] = { ...entry, goal, glasses: Math.min(entry.glasses, goal) };
    this.saveWater();
  },

  setGlasses(dateKey, glasses) {
    const entry = this.getEntry(dateKey);
    // Keep the number between 0 and the goal
    const safeGlasses = Math.min(Math.max(glasses, 0), entry.goal);
    const existingIndex = this.entries.findIndex((item) => item.date === dateKey);

    if (existingIndex === -1) {
      this.entries.push({ ...entry, glasses: safeGlasses });
    } else {
      this.entries[existingIndex] = { ...entry, glasses: safeGlasses };
    }
    this.saveWater();
  },

  addGlass(dateKey) {
    const entry = this.getEntry(dateKey);
    if (entry.glasses >= entry.goal) return false;
    this.setGlasses(dateKey, entry.glasses + 1);
    return true;
  },

  removeGlass(dateKey) {
    this.setGlasses(dateKey, this.getEntry(dateKey).glasses - 1);
  },

  resetWater(dateKey) {
    this.setGlasses(dateKey, 0);
  },

  isGoalReached(dateKey) {
    const entry = this.getEntry(dateKey);
    return entry.glasses >= entry.goal;
  },

  /* ---------- Event handlers ---------- */

  handleAddGlass() {
    const dateKey = App.state.selectedDate;
    const added = this.addGlass(dateKey);
    if (added && this.isGoalReached(dateKey)) {
      UI.showToast('Daily goal completed! Great job.');
    }
    App.refresh();
  },

  handleRemoveGlass() {
    this.removeGlass(App.state.selectedDate);
    App.refresh();
  },

  handleReset() {
    this.resetWater(App.state.selectedDate);
    UI.showToast('Water count reset.', 'info');
    App.refresh();
  },

  /* ---------- Rendering ---------- */

  /** Draws one drop per glass: filled for glasses drunk, outlined for glasses left. */
  renderGlasses(container, entry) {
    container.innerHTML = '';
    container.setAttribute('role', 'img');
    container.setAttribute('aria-label', `${entry.glasses} of ${entry.goal} glasses`);

    for (let i = 0; i < entry.goal; i++) {
      const isFull = i < entry.glasses;
      container.insertAdjacentHTML('beforeend',
        `<svg class="glass${isFull ? ' is-full' : ''}" aria-hidden="true"><use href="#drop"></use></svg>`);
    }
  },

  renderWater(dateKey) {
    const { count, goal, glasses, progress, message, addButton, removeButton, resetButton } = this.elements;
    const entry = this.getEntry(dateKey);
    const goalReached = entry.glasses >= entry.goal;

    count.textContent = entry.glasses;
    goal.textContent = entry.goal;
    progress.style.width = `${(entry.glasses / entry.goal) * 100}%`;
    this.renderGlasses(glasses, entry);

    message.textContent = goalReached ? 'Daily goal completed!' : `${entry.goal - entry.glasses} more to reach your goal.`;
    message.classList.toggle('is-complete', goalReached);

    addButton.disabled = goalReached;
    removeButton.disabled = entry.glasses === 0;
    resetButton.disabled = entry.glasses === 0;
  },
};

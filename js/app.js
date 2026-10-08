/**
 * app.js
 * Starts the app and connects the modules together:
 * - keeps the shared state (which date is selected, which view is open)
 * - switches views when the URL hash changes (#dashboard, #tasks, #diary, #settings)
 * - draws the Dashboard and the digital clock
 * - handles Light / Dark theme
 *
 * Data flow: a module changes its data → calls App.refresh() → every section re-renders.
 */

const Theme = {
  current: 'light',

  init() {
    // The inline script in <head> already set data-theme; read it back
    this.current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    this.button = document.getElementById('theme-toggle');
    this.button.addEventListener('click', () => this.toggle());
    this.render();
  },

  toggle() {
    this.set(this.current === 'dark' ? 'light' : 'dark');
  },

  set(theme) {
    this.current = theme;
    document.documentElement.setAttribute('data-theme', theme);
    Storage.saveData(STORAGE_KEYS.theme, theme);
    this.render();
    Settings.render(); // keep the Settings page radio buttons in sync
  },

  /** The button shows the theme you will switch TO. */
  render() {
    const nextTheme = this.current === 'dark' ? 'light' : 'dark';
    this.button.querySelector('use').setAttribute('href', nextTheme === 'dark' ? '#icon-moon' : '#icon-sun');
    this.button.querySelector('.theme-label').textContent = nextTheme === 'dark' ? 'Dark' : 'Light';
    this.button.setAttribute('aria-label', `Switch to ${nextTheme} mode`);
  },
};

const Clock = {
  init() {
    this.timeElement = document.getElementById('clock-time');
    this.secondsElement = document.getElementById('clock-seconds');
    this.periodElement = document.getElementById('clock-period');
    this.lastDateKey = DateUtils.todayKey();
    this.tick();
    // setInterval runs tick() again every 1000 ms (1 second)
    setInterval(() => this.tick(), 1000);
  },

  tick() {
    const now = new Date();
    const is12Hour = Settings.get('clockFormat') === '12';
    const hours24 = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    // 12-hour clock: 0 → 12, 13 → 1, ... plus AM / PM
    const displayHours = is12Hour ? String(hours24 % 12 || 12) : String(hours24).padStart(2, '0');

    this.timeElement.textContent = `${displayHours}:${minutes}`;
    this.timeElement.setAttribute('datetime', `${String(hours24).padStart(2, '0')}:${minutes}:${seconds}`);
    this.secondsElement.textContent = seconds;
    this.secondsElement.hidden = !Settings.get('showSeconds');
    this.periodElement.textContent = hours24 < 12 ? 'AM' : 'PM';
    this.periodElement.hidden = !is12Hour;

    // When midnight passes, refresh so "today" moves to the new day
    const todayKey = DateUtils.toDateKey(now);
    if (todayKey !== this.lastDateKey) {
      this.lastDateKey = todayKey;
      App.refresh();
    }
  },
};

const App = {
  VIEWS: ['dashboard', 'tasks', 'diary', 'settings'],
  // Old links from version 1 still work: #calendar opens the Dashboard, #water opens the Diary
  VIEW_ALIASES: { calendar: 'dashboard', water: 'diary' },
  state: {
    selectedDate: DateUtils.todayKey(),
    currentView: 'dashboard',
  },
  elements: {},

  init() {
    this.state.selectedDate = this.loadSelectedDate();
    this.cacheElements();

    Settings.init();
    Theme.init();
    Tasks.init();
    Water.init();
    Diary.init();
    Calendar.init();
    Clock.init();
    Weather.init();

    this.bindEvents();
    this.handleRouteChange({ moveFocus: false });
    this.renderAll();

    // Loading finished
    this.elements.loading.hidden = true;
    this.elements.main.removeAttribute('aria-busy');
  },

  cacheElements() {
    this.elements = {
      main: document.getElementById('main'),
      loading: document.getElementById('app-loading'),
      views: document.querySelectorAll('.view'),
      navLinks: document.querySelectorAll('.nav-link'),
      dateBar: document.getElementById('date-bar'),
      selectedDateLabel: document.getElementById('selected-date-label'),
      todayBadge: document.getElementById('today-badge'),
      backToTodayButton: document.getElementById('back-to-today-btn'),
      prevDayButton: document.getElementById('prev-day-btn'),
      nextDayButton: document.getElementById('next-day-btn'),
      dashboard: {
        greeting: document.getElementById('dash-greeting'),
        weekday: document.getElementById('dash-weekday'),
        fullDate: document.getElementById('dash-full-date'),
        todoProgressText: document.getElementById('dash-todo-progress-text'),
        todoProgress: document.getElementById('dash-todo-progress'),
        taskEmpty: document.getElementById('dash-task-empty'),
      },
      diaryTaskEmpty: document.getElementById('diary-task-empty'),
    };
  },

  bindEvents() {
    window.addEventListener('hashchange', () => this.handleRouteChange({ moveFocus: true }));

    this.elements.prevDayButton.addEventListener('click', () => this.changeDay(-1));
    this.elements.nextDayButton.addEventListener('click', () => this.changeDay(1));
    this.elements.backToTodayButton.addEventListener('click', () => this.setSelectedDate(DateUtils.todayKey()));
  },

  /* ---------- Selected date ---------- */

  loadSelectedDate() {
    const savedDate = Storage.loadData(STORAGE_KEYS.selectedDate, null);
    return DateUtils.isValidKey(savedDate) ? savedDate : DateUtils.todayKey();
  },

  setSelectedDate(dateKey) {
    this.state.selectedDate = dateKey;
    Storage.saveData(STORAGE_KEYS.selectedDate, dateKey);
    Calendar.showMonthOf(dateKey);
    this.renderAll();
  },

  changeDay(amount) {
    this.setSelectedDate(DateUtils.addDays(this.state.selectedDate, amount));
  },

  /* ---------- Views (simple hash router) ---------- */

  showView(viewName) {
    window.location.hash = viewName;
  },

  handleRouteChange({ moveFocus }) {
    const requestedView = window.location.hash.slice(1);
    const aliasedView = this.VIEW_ALIASES[requestedView] || requestedView;
    const viewName = this.VIEWS.includes(aliasedView) ? aliasedView : 'dashboard';
    this.state.currentView = viewName;

    this.elements.views.forEach((view) => {
      view.hidden = view.dataset.view !== viewName;
    });

    this.elements.navLinks.forEach((link) => {
      if (link.dataset.view === viewName) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    // The date bar is only needed by the pages that show one day: Tasks and Diary
    this.elements.dateBar.hidden = viewName === 'dashboard' || viewName === 'settings';

    window.scrollTo(0, 0);
    if (moveFocus) {
      // Move keyboard / screen reader focus to the new page's heading
      document.querySelector(`#view-${viewName} h1`).focus();
    }
  },

  /* ---------- Rendering ---------- */

  refresh() {
    this.renderAll();
  },

  renderAll() {
    const dateKey = this.state.selectedDate;
    this.renderDateBar(dateKey);
    this.renderDayWords(dateKey);
    this.renderDashboard();
    Settings.render();
    Tasks.renderTasks(dateKey);
    this.renderDiaryTasks(dateKey);
    Water.renderWater(dateKey);
    Diary.renderDiary(dateKey);
    Calendar.render();
  },

  renderDateBar(dateKey) {
    const isToday = DateUtils.isToday(dateKey);
    this.elements.selectedDateLabel.textContent = DateUtils.formatLong(dateKey);
    this.elements.todayBadge.hidden = !isToday;
    this.elements.backToTodayButton.hidden = isToday;
  },

  /** Replace words like "Today's Tasks" with "Oct 9 Tasks" when another day is selected. */
  renderDayWords(dateKey) {
    const isToday = DateUtils.isToday(dateKey);
    const shortDate = DateUtils.formatShort(dateKey);
    document.querySelectorAll('.day-word-cap').forEach((element) => {
      element.textContent = isToday ? "Today's" : shortDate;
    });
  },

  getGreeting() {
    const hour = new Date().getHours();
    const name = Settings.getDisplayName();
    if (hour < 12) return `Good morning, ${name}`;
    if (hour < 18) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  },

  /** The Dashboard always shows the real today (not the selected date). */
  renderDashboard() {
    const dash = this.elements.dashboard;
    const todayKey = DateUtils.todayKey();

    dash.greeting.textContent = this.getGreeting();
    dash.weekday.textContent = DateUtils.formatWeekday(todayKey);
    dash.fullDate.textContent = DateUtils.formatDate(todayKey);

    const taskSummary = Tasks.getSummary(todayKey);
    const taskPercent = taskSummary.total === 0 ? 0 : (taskSummary.completed / taskSummary.total) * 100;
    dash.todoProgress.style.width = `${taskPercent}%`;
    dash.todoProgressText.textContent = taskSummary.total === 0
      ? ''
      : `${taskSummary.completed} of ${taskSummary.total} done${taskSummary.remaining === 0 ? ' — all finished!' : ''}`;

    const taskCount = Tasks.renderMiniList(todayKey, 'dashboard');
    dash.taskEmpty.hidden = taskCount > 0;
    dash.todoProgress.parentElement.hidden = taskCount === 0;
  },

  renderDiaryTasks(dateKey) {
    const taskCount = Tasks.renderMiniList(dateKey, 'diary');
    this.elements.diaryTaskEmpty.hidden = taskCount > 0;
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());

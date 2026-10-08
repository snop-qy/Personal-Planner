/**
 * calendar.js
 * The Dashboard calendar + the monthly mood chart.
 *
 * Two different things are tracked:
 * - the month being DISPLAYED (viewYear / viewMonth) — changed by arrows or the month/year dropdowns
 * - the SELECTED date (App.state.selectedDate) — changed by clicking a day
 *
 * Clicking a day selects it and opens the Diary for that day.
 */

const Calendar = {
  YEAR_RANGE: 5, // years shown before and after the current year in the dropdown
  viewYear: 0,
  viewMonth: 0, // 0 = January ... 11 = December (same as JavaScript's Date)
  elements: {},

  init() {
    this.elements = {
      grid: document.getElementById('calendar-grid'),
      monthSelect: document.getElementById('cal-month-select'),
      yearSelect: document.getElementById('cal-year-select'),
      prevButton: document.getElementById('cal-prev-btn'),
      nextButton: document.getElementById('cal-next-btn'),
      todayButton: document.getElementById('cal-today-btn'),
      moodChart: document.getElementById('mood-chart'),
      moodChartEmpty: document.getElementById('mood-chart-empty'),
      moodChartCaption: document.getElementById('mood-chart-caption'),
      moodChartTitle: document.getElementById('mood-chart-title'),
    };

    this.showMonthOf(App.state.selectedDate);
    this.fillMonthOptions();
    this.bindEvents();
  },

  bindEvents() {
    const { grid, monthSelect, yearSelect, prevButton, nextButton, todayButton } = this.elements;

    prevButton.addEventListener('click', () => this.changeMonth(-1));
    nextButton.addEventListener('click', () => this.changeMonth(1));
    todayButton.addEventListener('click', () => this.goToToday());

    monthSelect.addEventListener('change', () => this.setMonth(this.viewYear, Number(monthSelect.value)));
    yearSelect.addEventListener('change', () => this.setMonth(Number(yearSelect.value), this.viewMonth));

    grid.addEventListener('click', (event) => {
      const dayButton = event.target.closest('.calendar-day');
      if (dayButton) {
        this.openDiaryFor(dayButton.dataset.date);
      }
    });
  },

  fillMonthOptions() {
    const { monthSelect } = this.elements;
    for (let month = 0; month < 12; month++) {
      const option = document.createElement('option');
      option.value = month;
      option.textContent = new Date(2000, month, 1).toLocaleDateString('en-US', { month: 'long' });
      monthSelect.appendChild(option);
    }
  },

  /** Year options: a range around this year, always including the year being viewed. */
  fillYearOptions() {
    const { yearSelect } = this.elements;
    const currentYear = new Date().getFullYear();
    const firstYear = Math.min(currentYear - this.YEAR_RANGE, this.viewYear);
    const lastYear = Math.max(currentYear + this.YEAR_RANGE, this.viewYear);

    yearSelect.innerHTML = '';
    for (let year = firstYear; year <= lastYear; year++) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      yearSelect.appendChild(option);
    }
  },

  showMonthOf(dateKey) {
    const date = DateUtils.fromDateKey(dateKey);
    this.viewYear = date.getFullYear();
    this.viewMonth = date.getMonth();
  },

  setMonth(year, monthIndex) {
    this.viewYear = year;
    this.viewMonth = monthIndex;
    this.render();
  },

  /** amount = -1 for previous month, +1 for next month. */
  changeMonth(amount) {
    // new Date() handles the year change for us: month -1 becomes December of last year
    const firstOfMonth = new Date(this.viewYear, this.viewMonth + amount, 1);
    this.setMonth(firstOfMonth.getFullYear(), firstOfMonth.getMonth());
  },

  goToToday() {
    App.setSelectedDate(DateUtils.todayKey());
  },

  openDiaryFor(dateKey) {
    App.setSelectedDate(dateKey);
    App.showView('diary');
  },

  render() {
    this.renderControls();
    this.renderCalendar();
    this.renderMoodChart();
  },

  renderControls() {
    this.fillYearOptions();
    this.elements.monthSelect.value = this.viewMonth;
    this.elements.yearSelect.value = this.viewYear;
  },

  renderCalendar() {
    const { grid } = this.elements;
    const selectedDate = App.state.selectedDate;
    const todayKey = DateUtils.todayKey();

    // getDay() of the 1st tells how many empty cells come before it (0 = Sunday)
    const firstWeekday = new Date(this.viewYear, this.viewMonth, 1).getDay();
    // Day 0 of next month = the last day of this month
    const daysInMonth = new Date(this.viewYear, this.viewMonth + 1, 0).getDate();

    // Build everything in a fragment first, then add it to the page in one step
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < firstWeekday; i++) {
      const emptyCell = document.createElement('span');
      emptyCell.className = 'calendar-cell is-empty';
      fragment.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = DateUtils.toDateKey(new Date(this.viewYear, this.viewMonth, day));
      fragment.appendChild(this.createDayButton(dateKey, day, dateKey === selectedDate, dateKey === todayKey));
    }

    grid.innerHTML = '';
    grid.appendChild(fragment);
  },

  createDayButton(dateKey, dayNumber, isSelected, isToday) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'calendar-cell calendar-day';
    button.dataset.date = dateKey;
    button.classList.toggle('is-selected', isSelected);
    button.classList.toggle('is-today', isToday);
    if (isToday) button.setAttribute('aria-current', 'date');

    const number = document.createElement('span');
    number.className = 'calendar-day-number';
    number.textContent = dayNumber;
    button.appendChild(number);

    const entry = Diary.getEntry(dateKey);
    const mood = entry ? Diary.getMood(entry.mood) : null;
    const taskCount = Tasks.getTasksByDate(dateKey).length;
    const labelParts = [DateUtils.formatLong(dateKey)];
    if (isToday) labelParts.push('today');

    // Mood face if one was picked, otherwise a small pen icon if a journal exists
    const marker = document.createElement('span');
    marker.className = 'calendar-day-mood';
    marker.setAttribute('aria-hidden', 'true');
    if (mood) {
      marker.innerHTML = Diary.moodIcon(mood);
      labelParts.push(`mood: ${mood.label}`);
    } else if (entry) {
      marker.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#icon-edit"></use></svg>';
      marker.classList.add('is-note');
      labelParts.push('has journal');
    }
    button.appendChild(marker);

    if (taskCount > 0) {
      const taskBadge = document.createElement('span');
      taskBadge.className = 'calendar-task-count';
      taskBadge.setAttribute('aria-hidden', 'true');
      taskBadge.textContent = taskCount;
      button.appendChild(taskBadge);
      labelParts.push(`${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`);
    }

    button.setAttribute('aria-label', `${labelParts.join(', ')}. Open diary`);
    return button;
  },

  /* ---------- Mood chart ---------- */

  /** Count how many days of the displayed month had each mood. */
  countMoods(year, monthIndex) {
    const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`;
    const counts = {};
    Diary.MOODS.forEach((mood) => { counts[mood.id] = 0; });

    Diary.entries
      .filter((entry) => entry.date.startsWith(monthPrefix) && counts[entry.mood] !== undefined)
      .forEach((entry) => { counts[entry.mood] += 1; });

    return counts;
  },

  renderMoodChart() {
    const { moodChart, moodChartEmpty, moodChartCaption, moodChartTitle } = this.elements;
    const counts = this.countMoods(this.viewYear, this.viewMonth);
    const totalDays = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const highestCount = Math.max(...Object.values(counts));
    const monthName = DateUtils.formatMonthYear(this.viewYear, this.viewMonth);

    const isCurrentMonth = this.viewYear === new Date().getFullYear() && this.viewMonth === new Date().getMonth();
    moodChartTitle.textContent = isCurrentMonth ? 'Mood this month' : `Mood · ${monthName}`;

    moodChart.innerHTML = '';
    moodChart.hidden = totalDays === 0;
    moodChartEmpty.hidden = totalDays > 0;
    moodChartCaption.textContent = totalDays === 0 ? '' : `${totalDays} ${totalDays === 1 ? 'day' : 'days'} logged in ${monthName}`;
    if (totalDays === 0) return;

    Diary.MOODS.forEach((mood) => {
      const count = counts[mood.id];
      const item = document.createElement('li');
      item.className = 'mood-row';
      item.classList.toggle('is-top', count > 0 && count === highestCount);
      item.title = `${mood.label}: ${count} ${count === 1 ? 'day' : 'days'}`;

      // Bar width is relative to the most common mood, so the longest bar fills the track
      const percent = highestCount === 0 ? 0 : (count / highestCount) * 100;
      item.innerHTML = `
        ${Diary.moodIcon(mood, 'mood-face mood-row-face')}
        <span class="mood-row-label">${mood.label}</span>
        <span class="mood-row-track" aria-hidden="true"><span class="mood-row-bar" style="width: ${percent}%"></span></span>
        <span class="mood-row-count">${count}<span class="visually-hidden"> ${count === 1 ? 'day' : 'days'}</span></span>
      `;
      moodChart.appendChild(item);
    });
  },
};

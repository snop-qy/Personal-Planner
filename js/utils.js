/**
 * utils.js
 * Helpers shared by every module: date formatting, unique IDs,
 * toast messages and the confirmation dialog.
 */

/*
 * Dates are stored as "date keys" in the format "YYYY-MM-DD" (e.g. "2026-10-07").
 * We build the key from the LOCAL date parts on purpose: date.toISOString() uses
 * UTC time, which can return yesterday's or tomorrow's date depending on the time zone.
 */
const DateUtils = {
  toDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  fromDateKey(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
  },

  todayKey() {
    return this.toDateKey(new Date());
  },

  isToday(dateKey) {
    return dateKey === this.todayKey();
  },

  isValidKey(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    // "2026-02-31" matches the pattern but is not a real date
    return this.toDateKey(this.fromDateKey(value)) === value;
  },

  addDays(dateKey, amount) {
    const date = this.fromDateKey(dateKey);
    date.setDate(date.getDate() + amount);
    return this.toDateKey(date);
  },

  /** "Wednesday" */
  formatWeekday(dateKey) {
    return this.fromDateKey(dateKey).toLocaleDateString('en-US', { weekday: 'long' });
  },

  /** "October 7, 2026" */
  formatDate(dateKey) {
    return this.fromDateKey(dateKey).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  },

  /** "Wednesday, October 7, 2026" */
  formatLong(dateKey) {
    return `${this.formatWeekday(dateKey)}, ${this.formatDate(dateKey)}`;
  },

  /** "Oct 7" */
  formatShort(dateKey) {
    return this.fromDateKey(dateKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  /** "October 2026" */
  formatMonthYear(year, monthIndex) {
    return new Date(year, monthIndex, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  },
};

/** Create a reasonably unique id such as "task-lx2k9a-4f8d1c". */
function generateId(prefix) {
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${timePart}-${randomPart}`;
}

const UI = {
  TOAST_DURATION_MS: 3000,

  /** Show a short message in the corner. type: "success" | "error" | "info" */
  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('is-leaving');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, this.TOAST_DURATION_MS);
  },

  /**
   * Open the confirmation dialog and wait for the user's answer.
   * Returns a Promise that resolves to true (confirmed) or false (cancelled).
   *
   * Usage:  const confirmed = await UI.confirm({ title, message });
   */
  confirm({ title, message, confirmLabel = 'Delete' }) {
    const dialog = document.getElementById('confirm-dialog');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-ok-btn').textContent = confirmLabel;

    // Pressing Escape closes the dialog without changing returnValue, so clear it first
    dialog.returnValue = '';

    return new Promise((resolve) => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
      dialog.showModal();
    });
  },

  /** Close a <dialog> when the user clicks on the dark backdrop around it. */
  closeOnBackdropClick(dialog) {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });
  },
};

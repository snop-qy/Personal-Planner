/**
 * tasks.js
 * To-do list: Create, Read, Update, Delete (CRUD), complete and filter tasks.
 *
 * A task looks like:
 * { id, title, description, priority: "low" | "medium" | "high", completed, date: "YYYY-MM-DD", createdAt }
 */

const Tasks = {
  items: [],
  currentFilter: 'all',
  editingTaskId: null, // null = the form is adding a new task, otherwise the id being edited
  elements: {},

  PRIORITY_LABELS: { low: 'Low', medium: 'Medium', high: 'High' },
  PRIORITY_ORDER: { high: 0, medium: 1, low: 2 },
  MINI_LIST_LIMIT: 6,

  init() {
    this.items = this.loadTasks();
    this.cacheElements();
    this.bindEvents();
  },

  cacheElements() {
    this.elements = {
      list: document.getElementById('task-list'),
      emptyState: document.getElementById('task-empty'),
      emptyMessage: document.getElementById('task-empty-message'),
      emptyAddButton: document.getElementById('task-empty-add-btn'),
      filterButtons: document.querySelectorAll('.filter-btn'),
      dashboardList: document.getElementById('dash-task-list'),
      diaryList: document.getElementById('diary-task-list'),
      dialog: document.getElementById('task-dialog'),
      dialogTitle: document.getElementById('task-dialog-title'),
      form: document.getElementById('task-form'),
      titleInput: document.getElementById('task-title-input'),
      titleError: document.getElementById('task-title-error'),
      descriptionInput: document.getElementById('task-description-input'),
      priorityInput: document.getElementById('task-priority-input'),
      dateInput: document.getElementById('task-date-input'),
      dateError: document.getElementById('task-date-error'),
      submitButton: document.getElementById('task-submit-btn'),
    };
  },

  bindEvents() {
    const { list, dashboardList, diaryList, form, dialog, titleInput } = this.elements;

    // Every "+ Add Task" button on the page shares this one listener
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-action="add-task"]')) {
        this.openTaskForm();
      } else if (event.target.closest('[data-action="add-task-today"]')) {
        this.openTaskForm(null, DateUtils.todayKey());
      }
    });

    this.elements.filterButtons.forEach((button) => {
      button.addEventListener('click', () => this.setFilter(button.dataset.filter));
    });

    // Event delegation: one listener on the <ul> handles clicks for every task inside it,
    // even tasks that are added later.
    list.addEventListener('click', (event) => this.handleListClick(event));
    list.addEventListener('change', (event) => this.handleCheckboxChange(event));
    dashboardList.addEventListener('change', (event) => this.handleCheckboxChange(event));
    diaryList.addEventListener('change', (event) => this.handleCheckboxChange(event));

    form.addEventListener('submit', (event) => this.handleFormSubmit(event));
    form.querySelector('[data-close-dialog]').addEventListener('click', () => this.closeTaskForm());
    titleInput.addEventListener('input', () => this.showFieldError('title', false));
    UI.closeOnBackdropClick(dialog);
  },

  /* ---------- Data (no DOM code here) ---------- */

  loadTasks() {
    return Storage.loadList(STORAGE_KEYS.tasks);
  },

  saveTasks() {
    const saved = Storage.saveData(STORAGE_KEYS.tasks, this.items);
    if (!saved) {
      UI.showToast('Could not save tasks. Browser storage may be full.', 'error');
    }
    return saved;
  },

  addTask({ title, description, priority, date }) {
    const newTask = {
      id: generateId('task'),
      title,
      description,
      priority,
      completed: false,
      date,
      createdAt: Date.now(),
    };
    this.items.push(newTask);
    this.saveTasks();
    return newTask;
  },

  updateTask(taskId, changes) {
    const task = this.findTask(taskId);
    if (!task) return null;

    Object.assign(task, changes);
    this.saveTasks();
    return task;
  },

  deleteTask(taskId) {
    this.items = this.items.filter((task) => task.id !== taskId);
    this.saveTasks();
  },

  toggleTask(taskId) {
    const task = this.findTask(taskId);
    if (!task) return null;
    return this.updateTask(taskId, { completed: !task.completed });
  },

  findTask(taskId) {
    return this.items.find((task) => task.id === taskId);
  },

  getTasksByDate(dateKey) {
    return this.items.filter((task) => task.date === dateKey);
  },

  filterTasks(tasks, filter) {
    if (filter === 'active') return tasks.filter((task) => !task.completed);
    if (filter === 'completed') return tasks.filter((task) => task.completed);
    return tasks;
  },

  /** Unfinished tasks first, then by priority (high → low), then oldest first. */
  sortTasks(tasks) {
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const priorityDifference = this.PRIORITY_ORDER[a.priority] - this.PRIORITY_ORDER[b.priority];
      if (priorityDifference !== 0) return priorityDifference;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  },

  getSummary(dateKey) {
    const tasksForDay = this.getTasksByDate(dateKey);
    const completed = tasksForDay.filter((task) => task.completed).length;
    return {
      total: tasksForDay.length,
      completed,
      remaining: tasksForDay.length - completed,
    };
  },

  /* ---------- Event handlers ---------- */

  setFilter(filter) {
    this.currentFilter = filter;
    this.renderTasks(App.state.selectedDate);
  },

  handleListClick(event) {
    const taskItem = event.target.closest('.task-item');
    if (!taskItem) return;

    const taskId = taskItem.dataset.id;
    if (event.target.closest('.edit-btn')) {
      this.openTaskForm(this.findTask(taskId));
    } else if (event.target.closest('.delete-btn')) {
      this.confirmDelete(taskId);
    }
  },

  handleCheckboxChange(event) {
    if (!event.target.matches('.task-checkbox')) return;

    const taskId = event.target.closest('[data-id]').dataset.id;
    const task = this.toggleTask(taskId);
    if (task && task.completed) {
      UI.showToast(`Yay! "${task.title}" is done.`);
    }
    App.refresh();
  },

  async confirmDelete(taskId) {
    const task = this.findTask(taskId);
    if (!task) return;

    const confirmed = await UI.confirm({
      title: 'Delete task?',
      message: `Are you sure you want to delete "${task.title}"? This cannot be undone.`,
    });

    if (confirmed) {
      this.deleteTask(taskId);
      UI.showToast('Task deleted.', 'info');
      App.refresh();
    }
  },

  /* ---------- Form ---------- */

  /** Open the form. Pass a task to edit it, or nothing to add a new one (due on defaultDate). */
  openTaskForm(task = null, defaultDate = App.state.selectedDate) {
    const { dialog, dialogTitle, form, titleInput, descriptionInput, priorityInput, dateInput, submitButton } = this.elements;

    form.reset();
    this.showFieldError('title', false);
    this.showFieldError('date', false);
    this.editingTaskId = task ? task.id : null;

    if (task) {
      dialogTitle.textContent = 'Edit Task';
      submitButton.textContent = 'Save Changes';
      titleInput.value = task.title;
      descriptionInput.value = task.description;
      priorityInput.value = task.priority;
      dateInput.value = task.date;
    } else {
      dialogTitle.textContent = 'Add Task';
      submitButton.textContent = 'Save Task';
      priorityInput.value = 'medium';
      dateInput.value = defaultDate;
    }

    dialog.showModal();
    titleInput.focus();
  },

  closeTaskForm() {
    this.elements.dialog.close();
    this.editingTaskId = null;
  },

  getFormValues() {
    const { titleInput, descriptionInput, priorityInput, dateInput } = this.elements;
    return {
      title: titleInput.value.trim(),
      description: descriptionInput.value.trim(),
      priority: priorityInput.value,
      date: dateInput.value,
    };
  },

  /** Returns an object of error flags, e.g. { title: true } when the title is empty. */
  validateTaskForm(values) {
    const errors = {};
    if (values.title === '') errors.title = true;
    if (!DateUtils.isValidKey(values.date)) errors.date = true;
    return errors;
  },

  showFieldError(fieldName, isVisible) {
    const input = fieldName === 'title' ? this.elements.titleInput : this.elements.dateInput;
    const errorText = fieldName === 'title' ? this.elements.titleError : this.elements.dateError;
    errorText.hidden = !isVisible;
    input.classList.toggle('is-invalid', isVisible);
    input.setAttribute('aria-invalid', String(isVisible));
  },

  handleFormSubmit(event) {
    event.preventDefault();

    const values = this.getFormValues();
    const errors = this.validateTaskForm(values);
    this.showFieldError('title', Boolean(errors.title));
    this.showFieldError('date', Boolean(errors.date));

    if (Object.keys(errors).length > 0) {
      (errors.title ? this.elements.titleInput : this.elements.dateInput).focus();
      return;
    }

    if (this.editingTaskId) {
      this.updateTask(this.editingTaskId, values);
      UI.showToast('Task updated.');
    } else {
      this.addTask(values);
      const isToday = DateUtils.isToday(values.date);
      UI.showToast(isToday ? 'Task added for today.' : `Task added to ${DateUtils.formatShort(values.date)}.`);
    }

    this.closeTaskForm();
    App.refresh();
  },

  /* ---------- Rendering ---------- */

  renderTasks(dateKey) {
    const { list, emptyState, emptyMessage, emptyAddButton } = this.elements;
    const tasksForDay = this.getTasksByDate(dateKey);
    const visibleTasks = this.sortTasks(this.filterTasks(tasksForDay, this.currentFilter));

    this.renderFilterButtons(tasksForDay);

    list.innerHTML = '';
    visibleTasks.forEach((task) => list.appendChild(this.createTaskElement(task)));

    // Conditional rendering: show the empty state only when there is nothing to list
    const isEmpty = visibleTasks.length === 0;
    emptyState.hidden = !isEmpty;
    list.hidden = isEmpty;

    if (isEmpty) {
      const dayWord = DateUtils.isToday(dateKey) ? 'today' : DateUtils.formatShort(dateKey);
      const messages = {
        all: `No tasks for ${dayWord}.`,
        active: 'No active tasks. Everything is done!',
        completed: 'No completed tasks yet.',
      };
      emptyMessage.textContent = messages[this.currentFilter];
      emptyAddButton.hidden = this.currentFilter === 'completed';
    }
  },

  renderFilterButtons(tasksForDay) {
    this.elements.filterButtons.forEach((button) => {
      const filter = button.dataset.filter;
      const isActive = filter === this.currentFilter;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
      button.querySelector('.filter-count').textContent = this.filterTasks(tasksForDay, filter).length;
    });
  },

  createTaskElement(task) {
    const item = document.createElement('li');
    item.className = `task-item priority-${task.priority}`;
    item.classList.toggle('is-completed', task.completed);
    item.dataset.id = task.id;

    const checkbox = this.createCheckbox(task);

    const body = document.createElement('div');
    body.className = 'task-body';

    const title = document.createElement('p');
    title.className = 'task-title';
    title.textContent = task.title;
    body.appendChild(title);

    if (task.description) {
      const description = document.createElement('p');
      description.className = 'task-description';
      description.textContent = task.description;
      body.appendChild(description);
    }

    const priorityBadge = document.createElement('span');
    priorityBadge.className = `priority-badge priority-badge-${task.priority}`;
    priorityBadge.textContent = this.PRIORITY_LABELS[task.priority];
    body.appendChild(priorityBadge);

    const actions = document.createElement('div');
    actions.className = 'task-actions';
    actions.append(
      this.createIconButton('edit-btn', 'icon-edit', `Edit task: ${task.title}`),
      this.createIconButton('delete-btn', 'icon-trash', `Delete task: ${task.title}`)
    );

    item.append(checkbox, body, actions);
    return item;
  },

  createCheckbox(task) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('aria-label', `Mark "${task.title}" as ${task.completed ? 'not completed' : 'completed'}`);
    return checkbox;
  },

  createIconButton(className, iconId, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `icon-btn ${className}`;
    button.setAttribute('aria-label', label);
    button.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#${iconId}"></use></svg>`;
    return button;
  },

  /** Short checklist used on the Dashboard ("dashboard") and in the Diary ("diary"). */
  renderMiniList(dateKey, listName) {
    const list = listName === 'diary' ? this.elements.diaryList : this.elements.dashboardList;
    const tasksForDay = this.sortTasks(this.getTasksByDate(dateKey));
    list.innerHTML = '';

    tasksForDay.slice(0, this.MINI_LIST_LIMIT).forEach((task) => {
      const item = document.createElement('li');
      item.className = 'mini-task';
      item.classList.toggle('is-completed', task.completed);
      item.dataset.id = task.id;

      const label = document.createElement('label');
      const title = document.createElement('span');
      title.textContent = task.title;
      label.append(this.createCheckbox(task), title);

      const dot = document.createElement('span');
      dot.className = `priority-dot priority-dot-${task.priority}`;
      dot.title = `${this.PRIORITY_LABELS[task.priority]} priority`;

      item.append(label, dot);
      list.appendChild(item);
    });

    const hiddenCount = tasksForDay.length - this.MINI_LIST_LIMIT;
    if (hiddenCount > 0) {
      const moreItem = document.createElement('li');
      moreItem.className = 'mini-task-more';
      moreItem.innerHTML = `<a class="text-link" href="#tasks">+ ${hiddenCount} more</a>`;
      list.appendChild(moreItem);
    }

    list.hidden = tasksForDay.length === 0;
    return tasksForDay.length;
  },
};

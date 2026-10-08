/**
 * diary.js
 * One journal entry per day, with an optional image.
 *
 * Saved as: [{ date: "2026-10-07", mood: "happy" | null, content: "Today I...", image: "data:image/jpeg;base64,..." | null, updatedAt }]
 *
 * The mood is saved as soon as it is clicked. The text and image are saved with the "Save Journal" button.
 *
 * About images: LocalStorage only stores text and most browsers allow about 5 MB per site.
 * So the image is (1) checked for type and size, (2) converted to text (a "data URL"),
 * and (3) scaled down so it takes much less space.
 */

const Diary = {
  MAX_FILE_SIZE_MB: 2,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  MAX_IMAGE_DIMENSION: 1200, // longest side in pixels after resizing
  IMAGE_QUALITY: 0.85,

  MOODS: [
    { id: 'lovely', label: 'Lovely' },
    { id: 'happy', label: 'Happy' },
    { id: 'calm', label: 'Calm' },
    { id: 'meh', label: 'Meh' },
    { id: 'tired', label: 'Tired' },
    { id: 'sad', label: 'Sad' },
    { id: 'angry', label: 'Angry' },
  ],

  entries: [],
  loadedDate: null, // the date whose entry is currently in the form
  draftImage: null, // image shown in the form (may not be saved yet)
  elements: {},

  init() {
    this.entries = this.loadDiary();
    this.elements = {
      form: document.getElementById('diary-form'),
      textarea: document.getElementById('diary-content'),
      status: document.getElementById('diary-status'),
      charCount: document.getElementById('diary-char-count'),
      imageInput: document.getElementById('diary-image-input'),
      imageName: document.getElementById('diary-image-name'),
      imageLoading: document.getElementById('diary-image-loading'),
      error: document.getElementById('diary-error'),
      preview: document.getElementById('diary-image-preview'),
      previewImage: document.getElementById('diary-preview-img'),
      removeImageButton: document.getElementById('diary-remove-image-btn'),
      deleteButton: document.getElementById('diary-delete-btn'),
      moodPicker: document.getElementById('mood-picker'),
      moodSelectedText: document.getElementById('mood-selected-text'),
    };
    this.createMoodButtons();
    this.bindEvents();
  },

  bindEvents() {
    const { form, textarea, imageInput, removeImageButton, deleteButton, moodPicker } = this.elements;

    moodPicker.addEventListener('click', (event) => {
      const moodButton = event.target.closest('.mood-btn');
      if (moodButton) {
        this.handleMoodClick(moodButton.dataset.mood);
      }
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleSave();
    });
    textarea.addEventListener('input', () => {
      this.hideError();
      this.updateFormStatus();
    });
    imageInput.addEventListener('change', (event) => this.handleImageSelect(event));
    removeImageButton.addEventListener('click', () => this.removeDraftImage());
    deleteButton.addEventListener('click', () => this.handleDelete());

    // Warn before closing the tab if the journal has unsaved text
    window.addEventListener('beforeunload', (event) => {
      if (this.hasUnsavedChanges()) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
  },

  /* ---------- Data ---------- */

  loadDiary() {
    return Storage.loadList(STORAGE_KEYS.diary);
  },

  /** Returns the saved entry for a date, or null if there is none. */
  getEntry(dateKey) {
    return this.entries.find((entry) => entry.date === dateKey) || null;
  },

  getMood(moodId) {
    return this.MOODS.find((mood) => mood.id === moodId) || null;
  },

  /** SVG markup for a mood face. Each face is a <symbol id="mood-..."> in index.html. */
  moodIcon(mood, className = 'mood-face') {
    return `<svg class="${className}" aria-hidden="true"><use href="#mood-${mood.id}"></use></svg>`;
  },

  /**
   * Create or replace the entry for a date with the given fields.
   * Returns true if saved. On failure the previous data is kept.
   */
  saveEntry(dateKey, changes) {
    const previousEntries = this.entries;
    const currentEntry = this.getEntry(dateKey) || { date: dateKey, mood: null, content: '', image: null };
    const newEntry = { ...currentEntry, ...changes, updatedAt: Date.now() };

    this.entries = [...this.entries.filter((entry) => entry.date !== dateKey), newEntry];

    if (!Storage.saveData(STORAGE_KEYS.diary, this.entries)) {
      this.entries = previousEntries;
      return false;
    }
    return true;
  },

  /** Pick a mood for a day. Clicking the same mood again removes it. */
  setMood(dateKey, moodId) {
    const entry = this.getEntry(dateKey);
    const newMood = entry && entry.mood === moodId ? null : moodId;

    // A day with no mood, text or image doesn't need an entry at all
    if (!newMood && entry && !entry.content && !entry.image) {
      this.deleteEntry(dateKey);
      return true;
    }
    return this.saveEntry(dateKey, { mood: newMood });
  },

  deleteEntry(dateKey) {
    this.entries = this.entries.filter((entry) => entry.date !== dateKey);
    Storage.saveData(STORAGE_KEYS.diary, this.entries);
  },

  /* ---------- Image handling ---------- */

  /** Returns an error message, or null if the file is OK. */
  validateImageFile(file) {
    if (!this.ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return 'Unsupported file type. Please choose a JPG, PNG or WebP image.';
    }
    if (file.size > this.MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `Image is too large. Please choose an image smaller than ${this.MAX_FILE_SIZE_MB} MB.`;
    }
    return null;
  },

  /** FileReader turns a file into a text "data URL" that can be stored and used as an <img> src. */
  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result));
      reader.addEventListener('error', () => reject(new Error('Could not read the file.')));
      reader.readAsDataURL(file);
    });
  },

  /**
   * Draw the image onto a smaller <canvas> and export it as JPEG.
   * A 2 MB phone photo usually becomes ~150 KB, so many entries fit in LocalStorage.
   */
  resizeImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.addEventListener('load', () => {
        const scale = Math.min(1, this.MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const context = canvas.getContext('2d');
        // JPEG has no transparency, so paint a white background first (for transparent PNGs)
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL('image/jpeg', this.IMAGE_QUALITY));
      });
      image.addEventListener('error', () => reject(new Error('This image could not be opened.')));

      image.src = dataUrl;
    });
  },

  async handleImageSelect(event) {
    const { imageInput, imageLoading, imageName } = this.elements;
    const file = event.target.files[0];
    if (!file) return;

    this.hideError();
    const validationError = this.validateImageFile(file);
    if (validationError) {
      this.showError(validationError);
      imageInput.value = '';
      return;
    }

    // Loading state while the image is being read and resized
    imageLoading.hidden = false;
    imageInput.disabled = true;

    try {
      const originalDataUrl = await this.readFileAsDataURL(file);
      this.draftImage = await this.resizeImage(originalDataUrl);
      imageName.textContent = file.name;
      this.renderImagePreview();
      this.updateFormStatus();
    } catch (error) {
      console.error(error);
      this.showError(`${error.message} Please try another image.`);
    } finally {
      imageLoading.hidden = true;
      imageInput.disabled = false;
      // Clear the input so choosing the same file again still fires "change"
      imageInput.value = '';
    }
  },

  removeDraftImage() {
    this.draftImage = null;
    this.elements.imageName.textContent = 'JPG, PNG or WebP · max 2 MB';
    this.renderImagePreview();
    this.updateFormStatus();
  },

  /* ---------- Save / delete ---------- */

  handleMoodClick(moodId) {
    const saved = this.setMood(App.state.selectedDate, moodId);
    if (!saved) {
      UI.showToast('Could not save your mood. Browser storage may be full.', 'error');
      return;
    }
    App.refresh();
  },

  handleSave() {
    const dateKey = App.state.selectedDate;
    const content = this.elements.textarea.value.trim();

    if (content === '' && !this.draftImage) {
      this.showError('Write something or add an image before saving.');
      this.elements.textarea.focus();
      return;
    }

    const saved = this.saveEntry(dateKey, { content, image: this.draftImage });
    if (!saved) {
      this.showError('Not enough browser storage to save this entry. Try removing the image or deleting old entries.');
      return;
    }

    this.hideError();
    UI.showToast('Journal saved.');
    App.refresh();
    this.updateFormStatus();
  },

  async handleDelete() {
    const dateKey = App.state.selectedDate;
    if (!this.getEntry(dateKey)) return;

    const confirmed = await UI.confirm({
      title: 'Delete journal entry?',
      message: `Are you sure you want to delete your journal for ${DateUtils.formatDate(dateKey)}? This cannot be undone.`,
    });

    if (confirmed) {
      this.deleteEntry(dateKey);
      this.loadEntryIntoForm(dateKey);
      UI.showToast('Journal entry deleted.', 'info');
      App.refresh();
    }
  },

  /* ---------- Form state ---------- */

  hasUnsavedChanges() {
    if (this.loadedDate === null) return false;

    const savedEntry = this.getEntry(this.loadedDate);
    const savedContent = savedEntry ? savedEntry.content : '';
    const savedImage = savedEntry ? savedEntry.image : null;
    return this.elements.textarea.value.trim() !== savedContent || this.draftImage !== savedImage;
  },

  loadEntryIntoForm(dateKey) {
    const entry = this.getEntry(dateKey);
    this.loadedDate = dateKey;
    this.elements.textarea.value = entry ? entry.content : '';
    this.draftImage = entry ? entry.image : null;
    this.elements.imageName.textContent = 'JPG, PNG or WebP · max 2 MB';
    this.hideError();
    this.renderImagePreview();
    this.updateFormStatus();
  },

  updateFormStatus() {
    const { textarea, charCount, status, deleteButton } = this.elements;
    const savedEntry = this.getEntry(App.state.selectedDate);

    charCount.textContent = `${textarea.value.length} / ${textarea.maxLength}`;
    deleteButton.disabled = !savedEntry;

    if (this.hasUnsavedChanges()) {
      status.textContent = 'Unsaved changes';
    } else if (savedEntry) {
      const savedTime = new Date(savedEntry.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      status.textContent = `Saved · last edited ${savedTime}`;
    } else {
      status.textContent = '';
    }
  },

  showError(message) {
    this.elements.error.textContent = message;
    this.elements.error.hidden = false;
  },

  hideError() {
    this.elements.error.hidden = true;
  },

  /* ---------- Rendering ---------- */

  createMoodButtons() {
    this.MOODS.forEach((mood) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `mood-btn mood-${mood.id}`;
      button.dataset.mood = mood.id;
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', 'false');
      button.innerHTML = `${this.moodIcon(mood, 'mood-face mood-btn-face')}<span class="mood-label">${mood.label}</span>`;
      this.elements.moodPicker.appendChild(button);
    });
  },

  renderMoodPicker(dateKey) {
    const entry = this.getEntry(dateKey);
    const selectedMood = entry ? this.getMood(entry.mood) : null;

    this.elements.moodPicker.querySelectorAll('.mood-btn').forEach((button) => {
      const isSelected = selectedMood !== null && button.dataset.mood === selectedMood.id;
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-checked', String(isSelected));
    });

    this.elements.moodSelectedText.textContent = selectedMood
      ? `You felt ${selectedMood.label.toLowerCase()} — tap it again to clear.`
      : 'Tap a face to save your mood for the day.';
  },

  renderImagePreview() {
    const { preview, previewImage } = this.elements;
    preview.hidden = !this.draftImage;
    if (this.draftImage) {
      previewImage.src = this.draftImage;
      previewImage.alt = `Image attached to the journal for ${DateUtils.formatDate(App.state.selectedDate)}`;
    } else {
      previewImage.removeAttribute('src');
    }
  },

  renderDiary(dateKey) {
    // Only reload the form when the date changes, so re-rendering after (say) ticking
    // a task doesn't wipe what the user is typing.
    if (dateKey !== this.loadedDate) {
      if (this.hasUnsavedChanges()) {
        UI.showToast('Unsaved journal changes were discarded.', 'info');
      }
      this.loadEntryIntoForm(dateKey);
    }
    this.renderMoodPicker(dateKey);
    this.updateFormStatus();
  },
};

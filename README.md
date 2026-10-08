# Personal Planner

A simple, friendly web app for planning your day — tasks, calendar, water tracking and a daily journal in one place.

> **Privacy:** This application stores user data locally in the browser using LocalStorage.
> Your tasks, diary and settings are never sent to a server, and there is no login. Clearing your browser data will erase your planner data.
> The only network request is for the weather: the latitude/longitude of the chosen city is sent to [Open-Meteo](https://open-meteo.com).

## Overview

Personal Planner is a frontend-only portfolio project built with plain HTML, CSS and JavaScript (no frameworks).
It shows how to build a real, usable web application with CRUD operations, persistent data, a responsive layout and dark mode — and deploy it as a live website.

## Features

- **Dashboard** — greeting, live digital clock, current weather, calendar, today's to-do list and a monthly mood chart
- **Weather** — temperature, condition (cute icons), high/low, feels-like, humidity and chance of rain; choose any city or use your location; °C / °F; refreshed every 30 minutes and cached for offline use
- **Calendar** — pick any month and year (dropdowns or arrows); each day shows its mood face and task count; tap a day to open that day's diary
- **Mood chart** — how many days you felt each mood in the month shown on the calendar
- **To-do list (CRUD)** — add, edit, delete (with confirmation) and complete tasks
- **Task filters** — All / Active / Completed, with counts
- **Task priority & due date** — Low / Medium / High
- **Diary / Journal** — one entry per day: mood, text and image, plus that day's to-do list and water tracker
- **Mood tracker** — 7 hand-drawn SVG faces (Lovely, Happy, Calm, Meh, Tired, Sad, Angry), saved instantly; tap again to clear
- **Water tracker** — daily glass goal (4–12, set in Settings), add / remove / reset, saved separately for each day
- **Image attachment** — JPG, PNG or WebP up to 2 MB, with preview before saving (images are resized to save space)
- **Settings** — your name, light/dark theme, 12/24-hour clock, show seconds, water goal, backup download/restore, delete all data
- **Pastel theme** — cute pink & yellow design with custom SVG icons and a rounded Thai/English font (Mali)
- **Data per date** — tasks, water and journal all change with the selected date
- **LocalStorage** — everything survives refresh and browser restarts
- **Dark mode** — remembers your choice (defaults to your system setting)
- **Responsive design** — sidebar on desktop, bottom navigation on mobile
- **UX states** — empty states, loading state, error messages and form validation
- **Accessibility basics** — semantic HTML, labels, keyboard support, focus styles, `aria` attributes

## Tech Stack

| Area        | Technology                                      |
| ----------- | ----------------------------------------------- |
| Structure   | HTML5                                           |
| Styling     | CSS3 (custom properties, Grid, Flexbox)         |
| Logic       | JavaScript ES6+ (no libraries)                  |
| Storage     | Browser LocalStorage                            |
| Weather API | [Open-Meteo](https://open-meteo.com) (free, no API key) via `fetch` |
| Tools       | Visual Studio Code, Git, GitHub, Chrome DevTools |
| Deployment  | GitHub Pages / Vercel                           |

## Screenshots

_Add screenshots to `assets/images/` and link them here._

| Dashboard (Light) | Dashboard (Dark) | Mobile |
| ----------------- | ---------------- | ------ |
| ![Dashboard light](assets/images/dashboard-light.png) | ![Dashboard dark](assets/images/dashboard-dark.png) | ![Mobile](assets/images/mobile.png) |

## Live Demo

🔗 https://snop-qy.github.io/Personal-Planner/

## Installation

No build step and no dependencies are needed.

```bash
# 1. Clone the repository
git clone https://github.com/snop-qy/Personal-Planner.git
cd Personal-Planner

# 2. Open the app
#    Option A: double-click index.html
#    Option B (recommended): use the VS Code "Live Server" extension → right-click index.html → "Open with Live Server"
```

### Deploy to GitHub Pages

1. Push the project to a GitHub repository named `Personal-Planner`.
2. Go to **Settings → Pages**.
3. Under **Source**, choose **Deploy from a branch**, select `main` and `/ (root)`, then **Save**.
4. After a minute your site is live at `https://snop-qy.github.io/Personal-Planner/`.

### Deploy to Vercel

1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. **Add New → Project** → import `Personal-Planner`.
3. Framework preset: **Other**. Leave the build command empty and click **Deploy**.

## Project Structure

```text
Personal-Planner/
├── index.html          # Page structure: header, navigation, all views, dialogs
├── css/
│   └── style.css       # Theme variables, layout, components, responsive rules
├── js/
│   ├── storage.js      # LocalStorage helpers: saveData / loadData / updateData / deleteData
│   ├── utils.js        # Date helpers, unique ids, toast messages, confirm dialog
│   ├── settings.js     # Preferences, backup download / restore, delete all data
│   ├── tasks.js        # To-do list CRUD, filters, form validation
│   ├── calendar.js     # Dashboard calendar (month/year picker, mood per day) + mood chart
│   ├── water.js        # Water tracker per day (shown in the Diary)
│   ├── diary.js        # Journal per day: moods, text, image upload & preview
│   ├── weather.js      # Weather from Open-Meteo: fetch, cache, city search, location
│   └── app.js          # App start-up, shared state, view switching, dashboard, clock, theme
├── assets/
│   ├── images/         # Screenshots
│   └── icons/          # Favicon
├── README.md
└── .gitignore
```

### How the code fits together

```text
User clicks something
   → module updates its data (e.g. Tasks.addTask)
   → module saves to LocalStorage (Storage.saveData)
   → App.refresh() re-renders every section for the selected date
```

### LocalStorage keys

| Key                     | Content                                                   |
| ----------------------- | --------------------------------------------------------- |
| `planner_tasks`         | `[{ id, title, description, priority, completed, date }]` |
| `planner_water`         | `[{ date, glasses, goal }]`                               |
| `planner_diary`         | `[{ date, mood, content, image, updatedAt }]`             |
| `planner_theme`         | `"light"` or `"dark"`                                     |
| `planner_selected_date` | `"YYYY-MM-DD"`                                            |
| `planner_settings`      | `{ name, clockFormat, showSeconds, waterGoal, weatherLocation, temperatureUnit }` |
| `planner_weather`       | Last weather result (cache, refreshed every 30 minutes)  |

## What I Learned

- **HTML** gives a page its structure and meaning (semantic tags like `<header>`, `<nav>`, `<main>`, `<dialog>`).
- **CSS** controls the look: custom properties make dark mode a matter of swapping variables; Grid and Flexbox build the layout; media queries make it responsive.
- **JavaScript & the DOM** — reading and changing the page with `document.getElementById`, `createElement`, `textContent`.
- **Events** — `addEventListener`, form `submit`, and event delegation (one listener for a whole list).
- **CRUD** — Create, Read, Update, Delete on an array of task objects.
- **Arrays vs Objects** — an array holds a list of items (all tasks); an object describes one item (one task's properties).
- **JSON & LocalStorage** — LocalStorage only stores strings, so data is converted with `JSON.stringify` / `JSON.parse`.
- **Dates** — building `YYYY-MM-DD` keys from local time to avoid time-zone bugs.
- **APIs & async JavaScript** — `fetch`, `async` / `await`, `try` / `catch`, loading & error states, caching results
- **Images in the browser** — `FileReader`, data URLs, and resizing with `<canvas>` to fit storage limits.
- **Git & GitHub** — small, meaningful commits and deploying with GitHub Pages.

## Future Improvements

- User Authentication
- Cloud Database
- Multiple device synchronization
- Habit Tracker
- Notifications / reminders
- Calendar events with times
- Export / import data (JSON)
- PWA support (install on phone, works offline)
- Custom water goal

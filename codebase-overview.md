# Habit Tracker — Codebase Overview

Quick reference for every file in the `Habit Tracker/` folder.

> **Improvement tracker → [habit-tracker-improvements.md](./habit-tracker-improvements.md)**

---

## Project Structure

```
Habit Tracker/
├── tracker.html                   # Original single-file app (legacy, keep for reference)
├── backend/
│   ├── server.js                  # Express API server (port 3000 via .env)
│   ├── models/Habit.js            # Mongoose schema (date + response enum)
│   ├── migrate.js                 # One-off migration script from tracker.html
│   └── .env / .env.example        # MongoDB URI + PORT config
└── frontend/
    ├── vite.config.js             # Vite dev server + /api proxy → localhost:3000
    ├── tailwind.config.js         # Tailwind design tokens (maps to CSS vars)
    └── src/
        ├── App.jsx                # Root layout: sticky header, two-column grid
        ├── api/
        │   └── habitsApi.js       # fetch() wrappers for backend routes
        ├── contexts/
        │   └── ThemeContext.jsx   # Dark/light theme state (localStorage)
        ├── hooks/
        │   ├── useHabitData.js    # TanStack Query data hook (main data source)
        │   └── useHabitName.js    # localStorage-backed habit name
        ├── utils/
        │   ├── dates.js           # Date key helpers, formatters, IST timezone
        │   └── stats.js           # Streaks, stats, fillMissingDays, CSV export
        ├── components/
        │   ├── HabitNameEditor.jsx
        │   ├── WelcomeBanner.jsx
        │   ├── StreakBanner.jsx
        │   ├── ProgressBars.jsx
        │   ├── StatsGrid.jsx
        │   ├── AdvancedStatsModal.jsx
        │   ├── ConfirmModal.jsx
        │   ├── ThemeToggle.jsx          # ⚠️ UNUSED — safe to delete
        │   ├── StreakCalendar/
        │   │   ├── StreakCalendar.jsx
        │   │   └── StreakCalendar.module.scss
        │   ├── LogEntry/
        │   │   ├── LogEntry.jsx
        │   │   └── LogEntry.module.scss
        │   └── History/
        │       ├── History.jsx
        │       └── History.module.scss
        └── styles/
            ├── globals.scss       # CSS design tokens, .ht-card, .ht-header
            └── _animations.scss
```

---

## Key Data Flow

```
MongoDB ── backend/server.js (port 3000)
                │  GET /api/habits
                ▼
         habitsApi.fetchHabits()
                │
         useHabitData.js (TanStack Query)
           rawData ──────────────────── App.jsx (first-time check)
                │
         fillMissingDays()
                │
         habitData ──── App.jsx ──── StreakBanner    (calculateStreaks)
                                ├── StreakCalendar  (direct cell render)
                                ├── LogEntry        (alreadyLogged check)
                                ├── ProgressBars    (getWeekData / getMonthData)
                                ├── StatsGrid       (getStats)
                                ├── History         (groupByMonth)
                                └── AdvancedStatsModal (getAdvancedStats)
```

---

## Backend

### `backend/server.js`

Express API server. Port from `process.env.PORT` (default 3000).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/habits` | Returns all logs as `{ "YYYY-MM-DD": "yes\|no" }` |
| POST | `/api/habits` | Upsert a single day `{ date, response }` |
| POST | `/api/habits/bulk` | Batch upsert (migration script only) |
| DELETE | `/api/habits/:date` | Remove a single day entry |

**⚠️** Routes must stay in sync with `frontend/src/api/habitsApi.js`. For multi-habit (1.1): add `POST /api/habits/new`, `DELETE /api/habits/:id`.

---

### `backend/models/Habit.js`

Mongoose schema: `date` (String, unique), `response` (enum `['yes', 'no']`).

**⚠️** Expanding response values (e.g. `'frozen'`, notes) requires updates in `server.js`, `habitsApi.js`, `useHabitData.js`, `stats.js`, and all components that render per-day values.

---

### `backend/migrate.js`

One-off script to import data from the old `tracker.html` localStorage export. Run manually: `node migrate.js`. Not part of the app runtime.

---

## Frontend — Config

## Frontend — Core Files

### `frontend/src/App.jsx`

Root layout. `lg:grid-cols-5` two-column grid: left col-span-2 = LogEntry + ProgressBars; right col-span-3 = StreakCalendar. Below grid: StatsGrid, CSV/Stats buttons, History, AdvancedStatsModal. Passes `habitData` and `habitName` down to all section components.

**⚠️** For multi-habit (1.1): habit selector/tabs go here.

---

### `frontend/src/api/habitsApi.js`

All `fetch()` calls to the backend. **Only call this from `useHabitData.js`** — never from components directly.

**Exports:** `fetchHabits()`, `saveHabit({ date, response })`, `bulkSaveHabits(habitData)`

---

### `frontend/src/hooks/useHabitData.js`

Central data source. Exposes `rawData` (server as-is), `habitData` (gaps filled via `fillMissingDays`), `logHabit()`, `isSaving`. Uses TanStack Query with optimistic updates and rollback on error. `rawData` is also passed to `App.jsx` for first-time-user detection.

---

### `frontend/src/hooks/useHabitName.js`

Stores/reads habit display name from `localStorage` key `ht_habit_name`. Default: `'my habit'`.


Exports `[name, updateName]`.

---

### `frontend/src/utils/stats.js`

All pure data functions — no side effects, no API calls. Key ones: `fillMissingDays`, `calculateStreaks`, `groupByMonth`, `downloadCSV`. **Touch this file** when response values expand or new stats are needed.

---

### `frontend/src/utils/dates.js`

Single source of truth for date formatting and timezone (`Asia/Kolkata`). All components use `getDateKey()` and `parseStoredDate()` from here.

---

## Frontend — Components (quick ref)

| Component | What it does |
|---|---|
| `HabitNameEditor` | Inline-editable name in the sticky header |
| `StreakBanner` | Hero streak counter, calls `calculateStreaks` internally |
| `StreakCalendar` | 5-week Sun–Sat grid; cell colors = yes/no/today |
| `LogEntry` | Yes/No buttons + optional date picker; overrides go through `ConfirmModal` |
| `ProgressBars` | Week + month progress bars |
| `StatsGrid` | 4-card stats row (days tracked, success %, streaks) |
| `History` | Collapsible year → month accordion; current year/month expanded by default |
| `AdvancedStatsModal` | Deep analytics modal (7/30-day averages, consistency score) |
| `ConfirmModal` | Generic confirm dialog used by `LogEntry` for overrides |
| `WelcomeBanner` | First-visit banner shown when `rawData` is empty |
| `ThemeToggle` | ⚠️ UNUSED — safe to delete |

---

## Multi-Habit Migration Guide (improvement 1.1)

| File | Change needed |
|---|---|
| `backend/models/Habit.js` | New `habitId`/`name`/`color` fields or separate collections |
| `backend/server.js` | New routes; existing GET/POST accept `habitId` |
| `frontend/src/api/habitsApi.js` | Add `createHabit()`, `deleteHabit()`; update fetch signatures |
| `frontend/src/hooks/useHabitData.js` | Accept `habitId` param; one query per habit |
| `frontend/src/App.jsx` | Habit selector tabs/cards |
| All display components | Accept `habitId` prop |

---

*Last updated: April 2026*

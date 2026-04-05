# Habit Tracker — Improvement Tracker

Progress doc for the React migration and ongoing improvements.
**Legend:** ✅ Resolved · 🔄 In Progress · ⏳ Planned · 🚫 Won't Fix (by design)

> **For file descriptions, relationships, and quick navigation → see [codebase-overview.md](./codebase-overview.md)**

---

## ✅ Resolved

- [x] **Streak resets at midnight** — `calculateStreaks` now starts from yesterday if today isn't logged yet; `fillMissingDays` skips today so it's never pre-filled as 'no'.
- [x] **Timezone mismatch** — All date key parsing uses `new Date(key + 'T00:00:00')` via `parseStoredDate()` to avoid UTC day-shift.
- [x] **Double API call on every save** — Removed bulk `saveData()` from the save flow; TanStack Query handles server sync with a single `POST /api/habits`.
- [x] **Logging feedback invisible** — `react-hot-toast` shows a ✅/❌ notification after every save; Yes/No buttons disable + fade while saving.
- [x] **Habit name hardcoded** — `useHabitName` hook stores name in `localStorage`; inline `HabitNameEditor` in header lets user rename at any time.
- [x] **All JS in one 600-line script** — Migrated to Vite + React. Code split into `api/`, `utils/`, `hooks/`, `components/`, `contexts/`.
- [x] **No loading or error states** — TanStack Query handles loading/error; full-page error UI with Retry; buttons disabled during save.
- [x] **History shows in-memory "no" entries for every unfilled gap** — added "Show only logged entries" toggle.
- [x] **CSV export includes auto-filled "no" gaps** — `Download CSV` now uses `rawData` (explicitly-logged only).
- [x] **History shows all months flat with no limit** — rebuilt as a collapsible year → month accordion; current year and current month expanded by default, all others collapsed. Month headers show `yes/total` badge.

---

## 🚫 Won't Fix (by design, acknowledged)

### `fillMissingDays()` marks gaps as "no"

Days between the first-ever log and today that were never opened are filled as "no" (missed). This is intentional — if you didn't record the habit, it counts as a miss. The only refinement applied is that **today** is never pre-filled so the streak isn't zeroed at midnight.

---

## 🔄 In Progress / Next Up

> **Next agent pick-up point** — calendar UI, layout gap, and history collapsible are all complete. Start with any ⏳ feature below.


---

## ⏳ Pending Features

### 1.1 Multiple habits support

**Priority:** 🔴 High

The app currently tracks a single habit. Users want to track 3–5 simultaneously (exercise, reading, meditation…). This requires a data model change:

```json
{
  "habits": [{ "id": "h1", "name": "Meditate", "color": "#6366f1" }],
  "logs": { "h1": { "2024-03-01": "yes" } }
}
```

Backend changes needed: new `Habit` and `HabitLog` collections, `POST /api/habits/new`, `DELETE /api/habits/:id`, update existing routes to accept `habitId`. Frontend: tab/card per habit, each with its own streak, calendar, and stats.

---

### 1.2 Streak protection / grace day

**Priority:** 🟡 Medium

One miss destroys any streak, no matter how long. Implement "streak freezes" (2/month): a user can mark a missed day as "frozen" — it doesn't break the streak. Calendar shows frozen days in a distinct cyan/❄️ colour. `calculateStreaks` treats `"frozen"` the same as `"yes"`.

---

### 1.3 Daily reminder / push notification

**Priority:** 🔴 High

Without a reminder, users forget to log. Use the Web Notifications API for a browser reminder at a user-chosen time. For reliable delivery when the browser is closed, integrate a Service Worker + `web-push` npm package on the backend. Add a simple time-picker in a Settings panel.

---

### 1.4 Notes per day

**Priority:** 🟢 Low

Log is purely binary. Add an optional note to each entry (e.g. "traveling today"). Show a small optional text field after clicking No. Notes appear as tooltips in the calendar and as small text in the history rows. Requires a schema migration on the backend: `response` becomes an object `{ response: "no", note: "..." }`.

---

### 1.5 Trend chart (rolling 7-day success rate)

**Priority:** 🟡 Medium

Advanced Stats modal only shows point-in-time numbers — no direction. Add a line chart (Recharts or Chart.js) inside the Advanced Stats modal showing the 7-day rolling success rate over time. Let users see at a glance whether they're improving or declining.

---

### 1.6 Offline support / PWA

**Priority:** 🟢 Low

App is unusable when the backend is down. Convert to a PWA with a Web App Manifest + Service Worker. The service worker should: cache UI assets for offline display, queue `POST /api/habits` requests offline and replay them when connectivity returns (Background Sync API).

---

*Last updated: April 2026 — React migration complete.*

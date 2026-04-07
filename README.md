# Habit Tracker

A full-stack habit tracking web app. Pick one habit, log it every day (yes or no), and watch your streak grow. The app fills in missed days automatically, shows you exactly how consistent you've been, and keeps the entire history in a collapsible timeline.

**Live demo:** [build-daily.vercel.app](https://build-daily.vercel.app)

---

## Features

### Logging
- **Yes / No logging** — one button tap per day, done
- **Keyboard shortcuts** — press `Y` or `N` anywhere on the page to log without touching the mouse
- **Backdating** — open a date picker to log or correct any past day
- **Override protection** — if you already logged today, a confirmation modal asks before overwriting

### Streaks & Stats
- **Streak banner** — large current streak display with milestone-based emojis/messages across early, mid, and long streak phases (from day 1 up to year-level milestones)
- **Longest streak** — tracked separately, never resets
- **Week and month progress bars** — see how far into the current week/month you are and how many "yes" days you've had
- **Stats grid** — four at-a-glance cards: total days tracked, successful days, success rate %, longest streak
- **Advanced stats modal** — deeper analytics with 7-day average, 30-day average, consistency score, missed days this month, and an auto-generated insight sentence

### Visual Calendar
- **5-week streak calendar** — a 35-cell Sun–Sat grid covering the last 5 weeks
- Cell colours: green = yes, red = no/missed, outlined = today (not yet logged)
- Hover or tap any cell to see the full date and status in an info bar below the grid
- Responsive font sizes — readable on both small and large screens

### History
- **Collapsible accordion** — your full history organised by year, then by month
- Current year and current month are expanded by default; everything else is collapsed
- Each year header shows total entries and number of months tracked
- Each month header shows a `yes / total` badge at a glance
- Entries inside display in a responsive grid (2–5 columns depending on screen width)
- **"Show only logged entries" toggle** — filter out auto-filled missing days to see only the days you actually logged

### Customisation & UX
- **Editable habit name** — click the name in the header to rename your habit inline; Enter to save, Escape to cancel
- **Dark / light theme** — toggle in the header; preference is saved to localStorage
- **CSV export** — download your full log as a spreadsheet with one click
- **Welcome banner** — shown on first visit with instructions; dismissible
- **Optimistic updates** — the UI responds instantly when you log; rolls back automatically if the server request fails
- **Fully responsive** — works on mobile, tablet, and desktop

### Daily Reminders (Push Notifications)
- **Toggle on/off** from the 🔔 Daily Reminder card
- Pick any reminder time (stored in IST) — backend cron fires a push at the exact minute
- In-app test button — sends an immediate push to verify the full pipeline
- Green banner confirms the push was received by the browser even if OS silences the notification
- Works on **Android** (Chrome/Firefox) natively; on **iOS 16.4+** the app must be added to the Home Screen first
- Silently disabled when VAPID keys are not configured (no errors shown to users)

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, TanStack Query v5, Tailwind CSS, SCSS Modules |
| Backend | Node.js, Express |
| Database | MongoDB with Mongoose |
| Hosting | Vercel (frontend) + Render (backend) + MongoDB Atlas (database) |

---

## Project Structure

```
Habit Tracker/
├── backend/
│   ├── server.js           # Express API server (port 3000 locally)
│   ├── models/Habit.js     # Mongoose schema: date (String, unique) + response enum (yes/no)
│   ├── migrate.js          # One-off migration script (legacy, not part of app runtime)
│   ├── .env.example        # Template for required backend env vars
│   └── package.json
└── frontend/
    ├── index.html
    ├── vite.config.js      # Dev proxy: /api → localhost:3000
    ├── tailwind.config.js  # Design tokens mapped to CSS custom properties
    ├── .env.example        # Template for required frontend env vars
    └── src/
        ├── main.jsx        # React entry point, TanStack QueryClient, ThemeProvider
        ├── App.jsx         # Root layout: sticky header + 5-col grid + all sections
        ├── api/
        │   └── habitsApi.js        # fetch() wrappers (fetchHabits, saveHabit, bulkSaveHabits)
        ├── hooks/
        │   ├── useHabitData.js     # Central data hook: rawData, habitData, logHabit, isSaving
        │   └── useHabitName.js     # Habit name in localStorage
        ├── utils/
        │   ├── dates.js            # Date helpers, IST timezone, formatters
        │   └── stats.js            # Pure functions: streaks, stats, fillMissingDays, groupByMonth, CSV
        ├── contexts/
        │   └── ThemeContext.jsx    # Dark/light theme state + localStorage persistence
        ├── components/
        │   ├── HabitNameEditor.jsx
        │   ├── WelcomeBanner.jsx
        │   ├── StreakBanner.jsx
        │   ├── ProgressBars.jsx
        │   ├── StatsGrid.jsx
        │   ├── AdvancedStatsModal.jsx
        │   ├── ConfirmModal.jsx
        │   ├── StreakCalendar/
        │   ├── LogEntry/
        │   └── History/
        └── styles/
            ├── globals.scss        # CSS design tokens, .ht-card, .ht-header utilities
            └── _animations.scss    # @keyframes used across components
```

---

## Local Development

### Prerequisites

- Node.js ≥ 18
- MongoDB running locally **or** a MongoDB Atlas connection string

### 1. Clone the repo

```bash
git clone https://github.com/kshitizsharma321/Habit-Tracker.git
cd Habit-Tracker
```

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Open `backend/.env` and set your MongoDB connection string:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/habit-tracker
# or Atlas:
# MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/habit-tracker?retryWrites=true&w=majority
```

Start the server:

```bash
node server.js
```

Backend runs at `http://localhost:3000`.

### 3. Frontend setup

Open a new terminal:

```bash
cd frontend
npm install
cp .env.example .env
# Default .env already points to http://localhost:3000/api — no changes needed for local dev
npm run dev
```

Frontend runs at `http://localhost:5173`. The Vite dev server proxies all `/api` requests to the backend automatically.

---

## API Routes

| Method | Path | Body / Params | Description |
|---|---|---|---|
| GET | `/api/habits` | — | Returns all logs as `{ "YYYY-MM-DD": "yes\|no" }` |
| POST | `/api/habits` | `{ date, response }` | Upsert a single day's log |
| POST | `/api/habits/bulk` | `{ "YYYY-MM-DD": "yes\|no", … }` | Batch upsert (migration use only) |
| DELETE | `/api/habits/:date` | — | Delete a single day's log |

All routes return JSON. Errors return `{ error: "message" }` with an appropriate HTTP status code.

---

## Environment Variables

### `backend/.env`

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string (local or Atlas) |
| `PORT` | optional | Server port — defaults to `3000`. Render sets this automatically. |
| `FRONTEND_URL` | production only | Your Vercel URL (no trailing slash) — restricts CORS to this origin |
| `VAPID_PUBLIC_KEY` | optional | Generate with `npx web-push generate-vapid-keys`. Required for push notifications. |
| `VAPID_PRIVATE_KEY` | optional | Private key from the same command. Keep secret — never commit. |

### `frontend/.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✅ | Backend base URL **including `/api`**, no trailing slash |
| `VITE_VAPID_PUBLIC_KEY` | optional | Must match `VAPID_PUBLIC_KEY` on the backend. Required for push notifications. |

> **Important:** Vite bakes env vars into the build at compile time. After changing any `VITE_*` var on Vercel you must trigger a manual redeploy for the new value to take effect.

> **Local vs production:** In local dev the Vite proxy handles `/api` routing, but in the production Vercel build there is no proxy — the frontend must call the Render URL directly via `VITE_API_URL`.

### Generating VAPID keys (one-time setup for push notifications)

```bash
npx web-push generate-vapid-keys
```

Copy the output into both `.env` files:
- `backend/.env` → `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`
- `frontend/.env` → `VITE_VAPID_PUBLIC_KEY` (public key only)

The same pair must be used across both files — mismatched keys will cause subscription failures.

---

## Deploying for Free

The app can be hosted completely free using MongoDB Atlas + Render + Vercel.

### Step 1 — MongoDB Atlas (database)

1. Sign up at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a new project → **Build a Database → M0 Free** (512 MB, no credit card needed)
3. Create a **database user** (username + strong password) — save these
4. Under **Network Access → Add IP Address**, set `0.0.0.0/0` to allow Render to connect
5. Click **Connect → Drivers** and copy the connection string — replace `<username>` and `<password>` with your credentials

### Step 2 — Backend on Render

1. Sign up at [render.com](https://render.com)
2. **New → Web Service** → connect your GitHub repo
3. Configure:
   - Root Directory: `backend`
   - Start Command: `node server.js`
   - Instance Type: **Free**
4. Add environment variables:
   - `MONGODB_URI` → Atlas connection string from Step 1
   - `FRONTEND_URL` → *(leave blank for now, add after Step 3)*
5. Click **Create Web Service** — after ~1 min you'll get a URL like `https://your-app.onrender.com`
6. Test by opening `https://your-app.onrender.com/api/habits` — should return `{}`

### Step 3 — Frontend on Vercel

1. Sign up at [vercel.com](https://vercel.com)
2. **Add New → Project** → import your GitHub repo
3. Configure:
   - Root Directory: `frontend`
   - Framework Preset: **Vite**
4. Add environment variable:
   - `VITE_API_URL` → `https://your-app.onrender.com/api` (your Render URL + `/api`, no trailing slash)
5. Click **Deploy** — you'll get a URL like `https://your-app.vercel.app`

### Step 4 — Wire CORS back to Render

1. Go back to Render → your service → **Environment**
2. Set `FRONTEND_URL` = `https://your-app.vercel.app` (no trailing slash)
3. Render redeploys automatically

### Step 5 — Push Notifications (optional)

1. Generate VAPID keys locally: `npx web-push generate-vapid-keys`
2. Add to **Render** environment variables:
   - `VAPID_PUBLIC_KEY` → the public key
   - `VAPID_PRIVATE_KEY` → the private key
3. Add to **Vercel** environment variables:
   - `VITE_VAPID_PUBLIC_KEY` → the same public key
4. Trigger a **manual redeploy on Vercel** (Vercel → Deployments → Redeploy) so Vite bakes the new env var into the build
5. To keep cron reliable on Render free tier: set up [UptimeRobot](https://uptimerobot.com) to ping `https://your-app.onrender.com/api/health` every 5 minutes

### Step 6 — Verify

Open your Vercel URL on your phone and log a habit. Check MongoDB Atlas → **Collections** to confirm the entry was saved.

---

### Hosting Limits (Free Tier)

| Service | Limit | Notes |
|---|---|---|
| MongoDB Atlas M0 | 512 MB storage | More than enough for years of daily logs |
| Render free | 750 hrs/month, sleeps after 15 min idle | First request after idle takes ~30–50 s (cold start) |
| Vercel free | Unlimited static deploys, 100 GB bandwidth | No restrictions for this use case |

> **Tip to avoid cold start delays:** Bookmark `https://your-app.onrender.com/api/habits` and open it once before using the app — this wakes the server in the background while you're opening the frontend.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Failed to connect to server" | `VITE_API_URL` is wrong or missing `/api` | Check Vercel env var — must end in `/api`. Redeploy after changing. |
| CORS error in browser console | `FRONTEND_URL` not set on Render | Add it in Render env vars (no trailing slash) |
| Backend 500 error | Wrong MongoDB URI or wrong password | Check Render env vars; check Atlas database user credentials |
| Data not saving | Atlas IP allowlist too restrictive | Set `0.0.0.0/0` in Atlas Network Access |
| First load takes 40+ seconds | Render cold start | Normal on free tier — wake the server first (see tip above) |
| Env var change not reflected | Vite bakes vars at build time | Trigger a manual redeploy on Vercel after any `VITE_*` change |
| Push notifications not appearing | macOS blocking Chrome notifications | System Settings → Notifications → Google Chrome → set to Alerts or Banners |
| "Test now" shows error | Browser subscription not registered in backend | Disable then Re-enable reminders in the app to re-register |
| Push works locally, not on Render | VAPID keys missing in Render env vars | Add `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` to Render → Environment |
| Push not working on iOS | iOS requires PWA installation | On iOS 16.4+: tap the Share icon in Safari → **Add to Home Screen**, then open from home screen and enable reminders |

---

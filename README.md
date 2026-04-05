# Habit Tracker

A full-stack habit tracking app. Log a daily yes/no for any habit, visualise streaks, and review history — accessible from any device via a hosted URL.

**Live demo:** [build-daily.vercel.app](https://build-daily.vercel.app)

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, TanStack Query, Tailwind CSS, SCSS Modules |
| Backend | Node.js, Express |
| Database | MongoDB (Atlas in production) |
| Hosting | Vercel (frontend) + Render (backend) |

---

## Project Structure

```
Habit Tracker/
├── backend/
│   ├── server.js          # Express API (port 5000 locally)
│   ├── models/Habit.js    # Mongoose schema
│   ├── migrate.js         # One-off migration script (legacy)
│   ├── .env.example       # Required env vars for backend
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── api/habitsApi.js
    │   ├── hooks/          # useHabitData (TanStack Query), useHabitName
    │   ├── components/     # StreakCalendar, History, LogEntry, StatsGrid, …
    │   ├── utils/          # stats.js, dates.js
    │   ├── contexts/       # ThemeContext
    │   └── styles/         # globals.scss, _animations.scss
    ├── .env.example        # Required env vars for frontend
    └── package.json
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
# Edit .env — set MONGODB_URI to your local MongoDB or Atlas string
npm start
```

Backend runs at `http://localhost:5000`.

### 3. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
# .env already points to http://localhost:5000/api by default — no edit needed for local dev
npm run dev
```

Frontend runs at `http://localhost:5173`.

---

## API Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/habits` | Fetch all habit logs as `{ "YYYY-MM-DD": "yes\|no" }` |
| POST | `/api/habits` | Upsert a single day `{ date, response }` |
| POST | `/api/habits/bulk` | Batch upsert (migration use only) |
| DELETE | `/api/habits/:date` | Delete a single day's log |

---

## Environment Variables

### `backend/.env`

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `PORT` | optional | Server port (default: `5000`). Render sets this automatically. |
| `FRONTEND_URL` | production | Your Vercel URL — restricts CORS to this origin |

### `frontend/.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✅ | Backend base URL **including `/api`** (e.g. `http://localhost:5000/api`) |

> Vite bakes env vars at build time. After changing a Vercel env var you **must trigger a redeploy** for it to take effect.

---

## Deploying (Free Tier)

### MongoDB Atlas
1. Create a free M0 cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a database user and copy the connection string
3. Under **Network Access** add `0.0.0.0/0` so Render can connect

### Backend → Render
1. New Web Service → connect this GitHub repo
2. Root Directory: `backend` | Start Command: `node server.js`
3. Add env vars:
   - `MONGODB_URI` = Atlas connection string
   - `FRONTEND_URL` = your Vercel URL (no trailing slash, e.g. `https://build-daily.vercel.app`)
4. Deploy and note the Render URL

### Frontend → Vercel
1. New Project → import this GitHub repo
2. Root Directory: `frontend` | Framework: Vite
3. Add env var:
   - `VITE_API_URL` = `https://<your-render-app>.onrender.com/api`
4. Deploy

> **Cold starts:** Render free tier spins down after 15 min of inactivity. The first request after idle takes ~30–50 s to wake the server — this is normal. Upgrade to Render's paid plan ($7/mo) to keep it always on.

---

## Features

- Daily yes/no habit logging with optional backdating
- 5-week streak calendar
- Current & longest streak counter
- Week/month progress bars
- Stats grid (days tracked, success rate, streaks)
- Advanced stats modal (7/30-day averages, consistency score)
- Collapsible year → month history accordion
- CSV export
- Dark/light theme
- Responsive — works on mobile

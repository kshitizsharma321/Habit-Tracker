# Habit Tracker

A full-stack, multi-user habit tracking web app. Create any number of habits, log them daily, and get streaks, stats, and real analytics. Sign in with a username/password or Google. Your nightly data is backed up to cloud storage automatically.

**Deployed on:** Vercel (frontend) · Render (backend) · MongoDB Atlas (database) · Supabase Storage (backups)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture at a Glance](#architecture-at-a-glance)
- [Project Structure](#project-structure)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Supabase Backup Setup](#supabase-backup-setup)
- [Deploying](#deploying)
- [Keeping Render Alive (Free Tier)](#keeping-render-alive-free-tier)
- [API Reference](#api-reference)
- [Data Model](#data-model)
- [Conventions & Notable Decisions](#conventions--notable-decisions)
- [Troubleshooting](#troubleshooting)

---

## Features

### Habits
- Create habits with a custom **name, colour, and icon**.
- Two tracking types:
  - **Completion** — yes/no. Streak builds from consecutive "done" days.
  - **Quantity** — numeric (km, hours, pages, glasses…). Set a threshold goal; a day counts toward the streak when you meet or exceed it.
- Edit, reorder (drag), and delete habits at any time. Deleting a habit clears its entries.
- **Template picker** for quick setup (Exercise, Reading, Water, etc.).

### Daily Dashboard
- All habits on one page; log inline without leaving the dashboard.
- Log for a **past date** via the custom in-app date picker.
- **Optimistic updates** — the UI responds instantly and rolls back on failure.
- Friendly, themed toast feedback on every action.

### Per-Habit Detail
A clean three-tab view (the URL stays a generic `/detail` — no ugly id):
- **Overview** — streak banner with milestone messaging (day 1 → 365+), stats grid, and a 5-week streak calendar.
- **Analytics** — `SmartInsights` (auto-generated text insights) plus `AnalyticsPanel` (consistency gauge, week/month comparison, day-of-week chart, improvement tips).
- **History** — collapsible year → month accordion, "show only logged entries" filter, and CSV export.

### Stats & Analytics
- Current + longest streak (longest never resets).
- Success rate, totals, averages — type-aware.
- Advanced algorithms, all dependency-free and computed client-side:
  - **EWMA** trend confirmation
  - **Wilson Score** lower bound for a confidence-adjusted consistency score
  - **Z-score** anomaly / personal-best detection
  - **Coefficient of Variation** for stability
  - **Pearson correlation** for day-of-week patterns
  - DIY **linear regression + forecast**

### Authentication
- **Username + password** registration and login (email optional; login also accepts email).
- Live username-availability check on the register/settings forms.
- **Google Sign-In** (one click) via `@react-oauth/google` + `google-auth-library`.
- JWT stored in `localStorage`; each user sees only their own data.
- Profile management: edit name/username/email, change password, toggle dark/light theme.

### Push Notifications
- Opt-in daily reminder at a **custom time** (per user), built on the Web Push API with VAPID keys and a service worker.
- "Test now" button to verify delivery.

### Admin
- Role-gated admin dashboard (`user.isAdmin`):
  - Usage **stats** (users / habits / entries — admins excluded).
  - **User management** — list, expand to view a user's habits, change role, delete (cascades all data + backup files).
  - **Backup & Restore** — per-user snapshot browser: download (signed URL), generate on demand, delete, or restore.
  - **CSV upload** — import entries from a backup-format CSV.
  - **Refresh** button with a live loading spinner.

### Backups
- A nightly cron (23:55 IST) writes **one CSV per user** (all habits, all entries) and uploads it to a **private Supabase Storage bucket**. MongoDB stores only the file path.
- Downloads use **short-lived (1-hour) signed URLs**, so backup files are never publicly exposed.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite 5, TanStack Query v5, Tailwind CSS 3, SCSS Modules, shadcn/ui (Radix), react-hot-toast |
| Backend | Node.js, Express 4, Mongoose 8, node-cron |
| Database | MongoDB Atlas (`habit-tracker` db) |
| Backup storage | Supabase Storage (private `habit-backups` bucket) |
| Auth | JWT + bcrypt + Google OAuth (`google-auth-library`) |
| Push | Web Push API, VAPID, Service Worker |
| Hosting | Vercel (FE) + Render (BE) |

---

## Architecture at a Glance

```
Browser (React SPA, Vercel)
   │  fetch via src/api/client.js  (injects JWT, handles 401)
   ▼
Express API (Render)  ──JWT auth──▶  MongoDB Atlas  (users, habits, entries, subscriptions, backup refs)
   │
   ├── node-cron: every minute   → Web Push reminders
   └── node-cron: 23:55 IST      → CSV per user → Supabase Storage (private bucket)
                                     MongoDB keeps only the filePath; downloads via signed URLs
```

- The frontend **never calls `fetch()` directly** — everything goes through `src/api/client.js`.
- The habit list is loaded once (`GET /habit-definitions`) and shared app-wide via the Layout's Outlet context; the dashboard endpoint returns **only entries**.

---

## Project Structure

```
Habit Tracker/
├── backend/
│   ├── server.js                   # Express entry — push sub routes, cron jobs, startup index sync, health
│   ├── routes/
│   │   ├── auth.js                 # register, login, google, me, check-username, profile, password, claim-data, delete
│   │   ├── habitDefinitions.js     # habit CRUD + entries + type-change + dashboard
│   │   └── admin.js                # admin: stats, users, role, per-user backups, restore, CSV import (requireAdmin)
│   ├── lib/
│   │   └── supabase.js             # Supabase client (service-role) + BACKUP_BUCKET constant
│   ├── middleware/
│   │   └── auth.js                 # signToken(), requireAuth (loads full req.user)
│   ├── models/
│   │   ├── User.js                 # username (unique sparse), email?, password, name, googleId, isAdmin, onboardingComplete
│   │   ├── HabitDefinition.js      # name, trackingType, unit, goal {enabled,value}, color, icon, order
│   │   ├── Habit.js                # userId, habitId, date, value — indexes {userId,habitId,date} & {userId,date}
│   │   ├── Subscription.js         # Web Push subscriptions
│   │   └── Backup.js               # backup reference: { userId, date, filePath, habitCount, entryCount }
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx                  # Root — providers, router, auth/onboarding gates, <Toaster>
    │   ├── pages/                   # TodayPage, HabitDetailPage, ManagePage, SettingsPage, AdminDashboard
    │   ├── components/
    │   │   ├── Layout.jsx           # App shell, header, mobile nav, Outlet context (definitions + mutations)
    │   │   ├── DynamicLogEntry/     # Type-aware log form (Done/Skip or numeric + presets)
    │   │   ├── StreakCalendar/      # 5-week colour grid
    │   │   ├── History/             # Year → month accordion
    │   │   ├── ManageHabits/        # HabitForm, HabitList, TemplateList
    │   │   ├── NotificationSettings/# Push toggle + custom time picker (Select)
    │   │   ├── OnboardingWizard/    # Template picker for new users
    │   │   ├── SmartInsights.jsx    # Generated insight cards
    │   │   ├── AnalyticsPanel.jsx   # Deep stats panel (gauge, charts, tips)
    │   │   ├── StatsGrid.jsx        # Stat cards
    │   │   ├── ProfileDropdown.jsx  # settings, theme, sign out
    │   │   ├── LoginPage.jsx        # Username + password + Google
    │   │   ├── RegisterPage.jsx     # Username (live availability) + email + password
    │   │   └── ui/                  # shadcn/ui: button, card, dialog, input, select, switch, tabs, date-picker…
    │   ├── lib/
    │   │   ├── toast.jsx            # notify.success/error/info() — themed toast helper (use instead of react-hot-toast)
    │   │   └── utils.js             # cn() classname helper
    │   ├── api/
    │   │   ├── client.js            # apiFetch / apiFetchJSON — auth headers, 401 redirect, base URL
    │   │   ├── authApi.js           # register, login, checkUsernameAvailability, updateProfile…
    │   │   ├── habitDefinitionsApi.js
    │   │   ├── entriesApi.js
    │   │   ├── onboardingApi.js
    │   │   └── adminApi.js          # stats, users, backups, signed-URL download, restore
    │   ├── hooks/                   # useHabitDefinitions, useHabitEntries, useOnboarding, useNotifications
    │   ├── contexts/                # AuthContext, ThemeContext
    │   ├── constants/habits.js      # TEMPLATES, COLORS, TYPE_LABELS
    │   ├── utils/
    │   │   ├── dates.js             # getDateKey(), parseStoredDate() — IST timezone
    │   │   └── stats/               # binary.js, numeric.js, insights.js, regression.js, shared.js
    │   └── styles/                  # globals.scss (CSS vars + dark mode), _animations.scss
    ├── vercel.json                  # SPA rewrite (all routes → index.html)
    ├── .env.example
    └── package.json
```

---

## Local Development

### Prerequisites
- Node.js ≥ 18
- MongoDB running locally **or** a free MongoDB Atlas cluster
- (Optional) A Supabase project if you want to test backups

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env — set MONGODB_URI and JWT_SECRET at minimum
npm run dev      # nodemon on port 3000
```

### 2. Frontend
```bash
cd frontend
npm install
cp .env.example .env
# VITE_API_URL is pre-filled to http://localhost:3000/api for local dev
npm run dev      # Vite at http://localhost:5173
```

Vite proxies `/api` → `http://localhost:3000`, so both servers run independently. Run `npm run build` in `frontend/` to verify a production build.

---

## Environment Variables

Both `.env.example` files document every variable with `[REQUIRED]`/`[OPTIONAL]` tags. Summary:

### `backend/.env`

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Random secret — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `FRONTEND_URL` | Production | CORS origin — your Vercel URL, no trailing slash |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Optional | Web Push keys (set both to enable reminders) |
| `GOOGLE_CLIENT_ID` | Optional | Enables Google Sign-In |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Optional | Enables nightly backups (set both). The service-role key is **server-only** — never expose it. |
| `PORT` | Optional | Default 3000; Render sets this automatically |

Generate VAPID keys once: `npx web-push generate-vapid-keys`

### `frontend/.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✅ | Backend base URL — `https://<your-app>.onrender.com/api` in production (no trailing slash) |
| `VITE_VAPID_PUBLIC_KEY` | Optional | Must match `VAPID_PUBLIC_KEY` in the backend |
| `VITE_GOOGLE_CLIENT_ID` | Optional | Must match `GOOGLE_CLIENT_ID` in the backend |

> If `SUPABASE_*` are unset, the app runs fine — the backup cron simply logs a warning and skips. If `VAPID_*` are unset, the reminders UI is hidden.

---

## Supabase Backup Setup

1. Create a project at [supabase.com](https://supabase.com) (free tier is enough).
2. **Storage → New bucket** → name it `habit-backups` → leave **"Public bucket" unchecked** (it must stay private) → Create.
3. **Settings → API** → copy the **Project URL** → `SUPABASE_URL`.
4. Copy the **Secret / `service_role` key** (NOT the publishable/anon key) → `SUPABASE_SERVICE_ROLE_KEY`.
5. Add both to the backend environment (Render → Environment, and your local `backend/.env`).

**How it works:** files are stored at `<userId>/<date>.csv` inside the private bucket. Because the bucket is private, there is no permanent public URL — the admin **Download** button mints a fresh 1-hour signed URL on demand (`GET /api/admin/users/:id/backups/:date/download`). The raw path stored in MongoDB is just the object key, not a clickable link. To grab a file ad-hoc, use that endpoint or the Supabase dashboard (Storage → file → *Get signed URL*).

---

## Deploying

### MongoDB Atlas
1. Create a free M0 cluster at [cloud.mongodb.com](https://cloud.mongodb.com).
2. Create a DB user and copy the connection string.
3. Network Access → allow `0.0.0.0/0` (or Render's IP range).

### Render (Backend)
1. New → Web Service → connect your GitHub repo.
2. Root directory: `backend` · Build: `npm install` · Start: `node server.js`.
3. Add all backend env vars (see table above).

### Vercel (Frontend)
1. New Project → import from GitHub.
2. Root directory: `frontend` · Framework preset: Vite.
3. Add all frontend env vars. `vercel.json` already handles SPA routing (deep links like `/detail` won't 404).

### Google Sign-In (optional)
1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials.
2. Create an OAuth 2.0 **Web** Client ID.
3. Add your Vercel URL and `http://localhost:5173` to **Authorized JavaScript Origins**.
4. Set `GOOGLE_CLIENT_ID` (backend) and `VITE_GOOGLE_CLIENT_ID` (frontend).

---

## Keeping Render Alive (Free Tier)

Render's free tier sleeps after **15 minutes of inactivity**. While asleep, the reminder and backup crons don't fire.

**Fix: a free external pinger** hitting the health endpoint every 5 minutes.

- **UptimeRobot** (recommended): New Monitor → HTTP(s) → `https://<your-app>.onrender.com/api/health` → interval 5 min.
- **cron-job.org** (alternative): New cronjob → same URL → every 5 minutes.

With a pinger running, both crons fire reliably:
- **Push reminders** — every minute, matches any subscription's `reminderTime` against the current IST time.
- **CSV backup** — daily at 23:55 IST (`55 18 * * *` in UTC).

### Changing the backup time
Edit one line in `backend/server.js` (cron is in **UTC**; IST = UTC + 5:30):
```js
cron.schedule('55 18 * * *', async () => {  // ← 23:55 IST
```
Examples: `30 17 * * *` = 23:00 IST · `30 0 * * *` = 06:00 IST · `0 12 * * *` = 17:30 IST

---

## API Reference

All `/api/admin/*` routes require `requireAuth` + `requireAdmin`.

### Auth
| Method | Path | Auth | Body / Params |
|---|---|---|---|
| POST | `/api/auth/register` | No | `{ username, password, email?, name? }` |
| POST | `/api/auth/login` | No | `{ username, password }` — also accepts email |
| POST | `/api/auth/google` | No | `{ credential }` |
| GET | `/api/auth/me` | Yes | — |
| GET | `/api/auth/check-username` | No | `?u=xxx` |
| PUT | `/api/auth/profile` | Yes | `{ name?, username?, email?, onboardingComplete? }` |
| PUT | `/api/auth/password` | Yes | `{ currentPassword, newPassword }` |
| POST | `/api/auth/claim-data` | Yes | `{ fromEmail }` |
| DELETE | `/api/auth/account` | Yes | Cascade-deletes all user data |

### Habit Definitions & Entries
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/habit-definitions` | Yes | Sorted list (source of truth for the habit list) |
| POST | `/api/habit-definitions` | Yes | Create |
| POST | `/api/habit-definitions/bulk` | Yes | Batch create (onboarding) |
| GET | `/api/habit-definitions/dashboard` | Yes | Today's entries + last-60-day entries (no definitions) |
| PUT | `/api/habit-definitions/reorder` | Yes | `{ orderedIds }` |
| PUT | `/api/habit-definitions/:id` | Yes | Update |
| DELETE | `/api/habit-definitions/:id` | Yes | Delete def + all entries |
| POST | `/api/habit-definitions/:id/change-type` | Yes | `{ newType, unit? }` (atomic conversion) |
| GET | `/api/habit-definitions/:id/entries` | Yes | Date-keyed map |
| POST | `/api/habit-definitions/:id/entries` | Yes | `{ date, value }` upsert |
| POST | `/api/habit-definitions/:id/entries/bulk` | Yes | `{ entries: [...] }` chunked upsert |
| DELETE | `/api/habit-definitions/:id/entries/:date` | Yes | Delete one entry |

### Admin
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/stats` | Counts (admins excluded) |
| GET | `/api/admin/users` | Non-admin users (no passwords) |
| GET | `/api/admin/users/:id/habits` | A user's habits |
| DELETE | `/api/admin/users/:id` | Delete user + cascade (incl. Supabase files) |
| PUT | `/api/admin/users/:id/role` | `{ isAdmin }` |
| GET | `/api/admin/users/:id/backups` | A user's snapshots (last 30) |
| GET | `/api/admin/users/:id/backups/:date/download` | `{ signedUrl }` (1-hour Supabase link) |
| POST | `/api/admin/users/:id/generate-backup` | Generate/overwrite today's backup |
| DELETE | `/api/admin/users/:id/backups/:date` | Delete snapshot (MongoDB + Supabase) |
| POST | `/api/admin/restore-from-backup` | `{ date, userId }` restore from stored backup |
| POST | `/api/admin/restore-data` | `{ csvText }` import from raw CSV |

### Push & System
| Method | Path | Auth |
|---|---|---|
| POST | `/api/subscriptions` | Yes |
| DELETE | `/api/subscriptions` | Yes |
| POST | `/api/test-push` | Yes |
| GET | `/api/health` | No |

---

## Data Model

- **User** — `username` (unique, sparse, primary login), `email?`, `password` (bcrypt), `name`, `googleId`, `isAdmin`, `onboardingComplete`.
- **HabitDefinition** — `userId`, `name`, `trackingType` (`completion`|`quantity`), `unit`, `goal { enabled, value }`, `order`, `color`, `icon`.
- **Habit** (one entry) — `userId`, `habitId`, `date` (`YYYY-MM-DD`), `value` (`'yes'|'no'` or a number). Unique on `{userId, habitId, date}`; extra `{userId, date}` index powers the dashboard.
- **Subscription** — `userId`, `endpoint`, `keys`, `reminderTime` (`HH:MM`).
- **Backup** — `userId`, `date`, `filePath` (Supabase object key), `habitCount`, `entryCount`. Unique on `{userId, date}` (same-day re-runs overwrite).

---

## Conventions & Notable Decisions

- **HTTP only via `client.js`** — components/hooks never call `fetch()` directly.
- **Toasts via `notify`** — `src/lib/toast.jsx` exposes `notify.success/error/info(title, description?)`; don't import `react-hot-toast` directly.
- **Dates are IST** — always use `getDateKey()` / `parseStoredDate()` from `utils/dates.js`; never hand-build date strings.
- **Colours via CSS vars / Tailwind tokens** — no raw hex in components. Dark mode via `[data-theme]`.
- **Generic detail route** — the per-habit page is `/detail` (no id in the URL); the active habit id lives in `sessionStorage` (`ht_active_habit`). Refresh-safe; a cold visit redirects home.
- **Role is not in the JWT** — the token carries only `userId`; `requireAuth` loads the full user each request, and `user.isAdmin` drives both the UI and `requireAdmin`. Role changes apply immediately.
- **Two tracking types only** — `completion` and `quantity`. (`choice` was removed and must not return.)

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Failed to connect" | Wrong `VITE_API_URL` | Must end with `/api`. Redeploy after changing. |
| CORS error | `FRONTEND_URL` not set on Render | Add your Vercel URL (no trailing slash) |
| 404 on refreshing a deep link | Missing SPA rewrite | `frontend/vercel.json` handles this — ensure it's deployed |
| "Invalid or expired token" | `JWT_SECRET` changed | Sign out and back in |
| Google button not showing | `VITE_GOOGLE_CLIENT_ID` not set | Add to the frontend env |
| Backups not appearing | `SUPABASE_*` unset or bucket missing | Set both env vars; create the private `habit-backups` bucket |
| Backup download fails | Wrong key / bucket not private-readable | Use the **service_role** key (not anon/publishable) |
| Push not appearing | Browser blocking | System Settings → Notifications → allow your browser |
| Server cold-start delay / cron skipped | Render free tier slept | Set up an UptimeRobot pinger (see above) |
| "Username already taken" | Conflict | Choose a different username |

---

*Last updated: June 2026 — Supabase Storage backups, generic `/detail` route, dashboard payload + index optimization, admin query gating, `notify` toast helper, username auth, analytics algorithms.*

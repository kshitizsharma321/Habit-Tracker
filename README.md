# Habit Tracker

A full-stack multi-habit tracking web app. Create any number of habits, log them daily, and see streaks, stats, and analytics. Multi-user with username/password + Google Sign-In.

**Deployed on:** Vercel (frontend) · Render (backend) · MongoDB Atlas

---

## Features

### Habits
- Create unlimited habits with custom name, colour, icon
- Two tracking types:
  - **Completion** — yes/no; streak builds from consecutive "yes" days
  - **Quantity** — numeric (km, hours, pages…); set a threshold goal; streak builds when you meet or exceed it
- Edit, reorder, and delete habits at any time
- Template picker for quick setup (Exercise, Reading, Water, etc.)

### Daily Dashboard
- All habits on one page; log inline without leaving the dashboard
- Log for a past date using the custom date picker
- Optimistic updates — UI responds instantly, rolls back on failure

### Stats & Analytics
- Streak: current + longest (never resets)
- Stats grid: total days, success rate, streak
- **SmartInsights** — auto-generated text insights: day-of-week patterns, trends, personal bests, goal progress
- **AnalyticsPanel** — consistency score (Wilson Score confidence interval), week/month comparison, day-of-week bar chart, improvement tips
- Advanced algorithms: EWMA trend confirmation, Z-score anomaly detection, Coefficient of Variation, Pearson correlation

### Per-Habit Detail
- Overview tab: streak banner (milestone messages 1–365+ days), stats, goal progress, streak calendar
- Analytics tab: SmartInsights + AnalyticsPanel
- History tab: collapsible year → month accordion, filtered view, CSV export

### Authentication
- **Username + password** registration and login
- **Google Sign-In** (one click, no password required)
- JWT stored in localStorage; persists across sessions
- Each user sees only their own data
- Profile: edit name, username, email; change password; dark/light theme

### Push Notifications
- Daily reminder at a custom time (configurable per user)
- Built on the Web Push API with VAPID keys
- Custom time picker (no browser native `<input type="time">`)

### Admin
- Admin dashboard: user list, usage stats, delete users, CSV upload/restore, daily backup browser

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite 5, TanStack Query v5, Tailwind CSS 3, SCSS Modules, shadcn/ui (Radix) |
| Backend | Node.js, Express 4, Mongoose 8 |
| Database | MongoDB Atlas |
| Auth | JWT + bcrypt + Google OAuth (`google-auth-library`) |
| Push | Web Push API, VAPID, Service Worker |
| Hosting | Vercel + Render + MongoDB Atlas |

---

## Project Structure

```
Habit Tracker/
├── backend/
│   ├── server.js                   # Express entry — push sub routes, cron jobs, health
│   ├── routes/
│   │   ├── auth.js                 # register, login, google, me, check-username, profile, password, delete
│   │   ├── habitDefinitions.js     # Full habit CRUD + entries + type-change + dashboard
│   │   └── admin.js                # Admin stats, user management, CSV restore, backups
│   ├── middleware/
│   │   └── auth.js                 # signToken(), requireAuth middleware
│   ├── models/
│   │   ├── User.js                 # username (unique), email, password, name, googleId
│   │   ├── HabitDefinition.js      # name, trackingType, unit, goal, color, icon, order
│   │   ├── Habit.js                # userId, habitId, date, value (entry)
│   │   ├── Subscription.js         # Web Push subscriptions
│   │   └── Backup.js               # Daily CSV snapshots (persist after deletion)
│   ├── scripts/
│   │   ├── migrate-usernames.js    # One-time: generate usernames for existing users
│   │   ├── migrate-goals.js        # One-time: strip goal.period field from all habits
│   │   └── cleanup-orphans.js      # One-time: remove orphaned entries/defs/subs
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx                  # Root — providers, router, auth/onboarding gate
    │   ├── pages/                   # TodayPage, HabitDetailPage, ManagePage, SettingsPage, AdminDashboard
    │   ├── components/
    │   │   ├── Layout.jsx           # App shell, header, mobile nav
    │   │   ├── DynamicLogEntry/     # Type-aware log form
    │   │   ├── StreakCalendar/      # 5-week colour grid
    │   │   ├── History/             # Year → month accordion
    │   │   ├── ManageHabits/        # HabitForm, HabitList, TemplateList
    │   │   ├── NotificationSettings/# Push toggle + custom time picker
    │   │   ├── OnboardingWizard/    # Template picker for new users
    │   │   ├── SmartInsights.jsx    # Generated insight cards
    │   │   ├── AnalyticsPanel.jsx   # Deep stats panel
    │   │   ├── GoalsTracker.jsx     # Today's value vs goal threshold
    │   │   ├── StatsGrid.jsx        # Stats cards
    │   │   ├── ProfileDropdown.jsx  # @username, settings, theme, sign out
    │   │   ├── LoginPage.jsx        # Username + password + Google
    │   │   ├── RegisterPage.jsx     # Username (live availability) + email + password
    │   │   └── ui/                  # shadcn/ui: button, card, dialog, input, select, tabs…
    │   ├── api/
    │   │   ├── client.js            # apiFetch / apiFetchJSON — auth headers, 401 redirect
    │   │   ├── authApi.js           # register, login, checkUsernameAvailability, updateProfile…
    │   │   ├── habitDefinitionsApi.js
    │   │   ├── entriesApi.js
    │   │   ├── onboardingApi.js
    │   │   └── adminApi.js
    │   ├── hooks/                   # useHabitDefinitions, useHabitEntries, useOnboarding, useNotifications
    │   ├── contexts/                # AuthContext, ThemeContext
    │   ├── constants/habits.js      # TEMPLATES, COLORS, TYPE_LABELS
    │   ├── utils/
    │   │   ├── dates.js             # getDateKey(), parseStoredDate() — IST timezone
    │   │   └── stats/               # binary.js, numeric.js, insights.js, regression.js, shared.js
    │   └── styles/                  # globals.scss (CSS vars + dark mode), _animations.scss
    ├── .env.example
    └── package.json
```

---

## Local Development

### Prerequisites
- Node.js ≥ 18
- MongoDB (local) or a free MongoDB Atlas cluster

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env — set MONGODB_URI and JWT_SECRET at minimum
npm run dev     # nodemon on port 3000
```

### 2. Frontend
```bash
cd frontend
npm install
cp .env.example .env
# VITE_API_URL is pre-set to http://localhost:3000/api for local dev
npm run dev     # Vite at http://localhost:5173
```

Vite proxies `/api` → `http://localhost:3000` so both servers run independently.

---

## Environment Variables

### `backend/.env`

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Random secret — generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `FRONTEND_URL` | Production | CORS origin — your Vercel URL, no trailing slash |
| `VAPID_PUBLIC_KEY` | Optional | Web Push public key (enables push notifications) |
| `VAPID_PRIVATE_KEY` | Optional | Web Push private key |
| `GOOGLE_CLIENT_ID` | Optional | Enables Google Sign-In |
| `PORT` | Optional | Default 3000; Render sets this automatically |

Generate VAPID keys once:
```bash
npx web-push generate-vapid-keys
```

### `frontend/.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✅ | Backend URL — `https://<your-app>.onrender.com/api` in production |
| `VITE_VAPID_PUBLIC_KEY` | Optional | Must match `VAPID_PUBLIC_KEY` in backend `.env` |
| `VITE_GOOGLE_CLIENT_ID` | Optional | Must match `GOOGLE_CLIENT_ID` in backend `.env` |

---

## Deploying

### MongoDB Atlas
1. Create a free M0 cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a database user and copy the connection string
3. Add `0.0.0.0/0` to Network Access (or Render's IP range)

### Render (Backend)
1. New → Web Service → connect your GitHub repo
2. Root directory: `backend` · Build: `npm install` · Start: `node server.js`
3. Add all backend env vars (see table above)

### Vercel (Frontend)
1. New Project → import from GitHub
2. Root directory: `frontend` · Framework: Vite
3. Add all frontend env vars

### Google Sign-In (optional)
1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an OAuth 2.0 Web Client ID
3. Add your Vercel URL + `http://localhost:5173` to Authorized JavaScript Origins
4. Set `GOOGLE_CLIENT_ID` (backend) and `VITE_GOOGLE_CLIENT_ID` (frontend)

---

## Keeping Render Alive (Free Tier)

Render's free tier sleeps your server after **15 minutes of inactivity**. While asleep, the push notification cron and daily CSV backup cron are skipped.

**Solution: use a free external pinger.**

### UptimeRobot (recommended, free)
1. Sign up at [uptimerobot.com](https://uptimerobot.com)
2. New Monitor → HTTP(s)
3. URL: `https://<your-app>.onrender.com/api/health`
4. Interval: **5 minutes**
5. Save — your server will never sleep again

### cron-job.org (alternative)
1. Sign up at [cron-job.org](https://cron-job.org)
2. New cronjob → URL: `https://<your-app>.onrender.com/api/health`
3. Schedule: every 5 minutes
4. Save

With the pinger running, both crons fire reliably:
- **Push reminders** — every minute, checks if any subscription's `reminderTime` matches the current IST time
- **CSV backup** — daily at 23:55 IST (`55 18 * * *` UTC)

### Changing the backup time
Edit one line in `backend/server.js`:
```js
// Format: 'minute hour * * *' in UTC  (IST = UTC + 5:30)
cron.schedule('55 18 * * *', async () => {  // ← 23:55 IST
```
Examples: `30 17 * * *` = 23:00 IST · `30 0 * * *` = 06:00 IST · `0 12 * * *` = 17:30 IST

---

## One-Time Migration Scripts

Run these **once** after deploying the V2 update, then never again. They connect directly to MongoDB Atlas (no server needed).

```bash
cd backend

# 1. Generate usernames for any users who registered before username auth
node scripts/migrate-usernames.js

# 2. Strip the old goal.period field from all habit definitions
node scripts/migrate-goals.js

# 3. (Optional) Remove orphaned entries/definitions from deleted accounts
node scripts/cleanup-orphans.js
```

All scripts are idempotent — safe to re-run if interrupted. They read `MONGODB_URI` from `backend/.env`.

---

## API Routes

### Auth
| Method | Path | Auth | Body / Params |
|---|---|---|---|
| POST | `/api/auth/register` | No | `{ username, password, email?, name? }` |
| POST | `/api/auth/login` | No | `{ username, password }` — also accepts email as username |
| POST | `/api/auth/google` | No | `{ credential }` |
| GET | `/api/auth/me` | Yes | — |
| GET | `/api/auth/check-username` | No | `?u=xxx` |
| PUT | `/api/auth/profile` | Yes | `{ name?, username?, email?, onboardingComplete? }` |
| PUT | `/api/auth/password` | Yes | `{ currentPassword, newPassword }` |
| DELETE | `/api/auth/account` | Yes | Cascade-deletes all user data |

### Habit Definitions
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/habit-definitions` | Yes | Sorted list |
| POST | `/api/habit-definitions` | Yes | Create |
| POST | `/api/habit-definitions/bulk` | Yes | Batch create (onboarding) |
| GET | `/api/habit-definitions/dashboard` | Yes | All defs + today's entries + 60-day entries |
| PUT | `/api/habit-definitions/reorder` | Yes | `{ orderedIds }` |
| PUT | `/api/habit-definitions/:id` | Yes | Update |
| DELETE | `/api/habit-definitions/:id` | Yes | Delete def + all entries |
| POST | `/api/habit-definitions/:id/change-type` | Yes | `{ newType, unit? }` |
| GET | `/api/habit-definitions/:id/entries` | Yes | Date-keyed map |
| POST | `/api/habit-definitions/:id/entries` | Yes | `{ date, value }` upsert |
| DELETE | `/api/habit-definitions/:id/entries/:date` | Yes | Delete one entry |

### Push & System
| Method | Path | Auth |
|---|---|---|
| POST | `/api/subscriptions` | Yes |
| DELETE | `/api/subscriptions` | Yes |
| POST | `/api/test-push` | Yes |
| GET | `/api/health` | No |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Failed to connect" | Wrong `VITE_API_URL` | Must end with `/api`. Redeploy after change. |
| CORS error | `FRONTEND_URL` not set on Render | Add your Vercel URL (no trailing slash) |
| "Invalid or expired token" | `JWT_SECRET` changed | Sign out and back in |
| Google button not showing | `VITE_GOOGLE_CLIENT_ID` not set | Add to frontend env |
| Push not appearing | Browser blocking | System Settings → Notifications → allow your browser |
| Server cold-start delay | Render free tier slept | Set up UptimeRobot pinger (see above) |
| Cron skipped | Server was asleep at fire time | Set up UptimeRobot pinger (see above) |
| "Username already taken" on register | Conflict | Choose a different username |

---

*Last updated: June 2026 — multi-habit V2, username auth, analytics algorithms, goal/streak redesign, custom UI components, admin dashboard.*

# Free Hosting Guide — Habit Tracker

Host the full-stack app (MongoDB + Express backend + Vite/React frontend) for free so you can access it from your phone or any device.

**Stack:**
- **MongoDB** → MongoDB Atlas (free M0 cluster)
- **Backend** → Render.com (free tier)
- **Frontend** → Vercel (free tier)

> ⚠️ Render free tier spins down after 15 min of inactivity. First request after idle takes ~30–50 s (cold start). Upgrade to a paid tier ($7/mo) to avoid this.

---

## Step 1 — MongoDB Atlas (free cloud database)

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) and create a free account.
2. Create a new **Project**, then click **Build a Database → M0 Free** (512 MB, no credit card).
3. Choose any cloud region close to you (e.g. `aws / ap-south-1` for India).
4. Create a **database user**: username + strong password. Save these — you'll need them for the connection string.
5. Under **Network Access → Add IP Address**, click **Allow Access from Anywhere** (`0.0.0.0/0`). This is required for Render to connect.
6. On the cluster page click **Connect → Drivers**, copy the connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<username>` and `<password>` with the credentials from step 4.

---

## Step 2 — Code changes before deploying

### 2a. Add CORS to the Express backend

Install the `cors` package:
```bash
cd backend
npm install cors
```

In `backend/server.js`, add near the top (before routes):
```js
const cors = require('cors');

app.use(cors({
  origin: process.env.FRONTEND_URL || '*', // set to your Vercel URL in production
}));
```

### 2b. Make the frontend use the deployed backend URL

In `frontend/src/api/habitsApi.js`, change the base URL so it reads from an env variable in production:
```js
const BASE_URL = import.meta.env.VITE_API_URL || '/api';
```

> The Vite dev proxy (`/api` → `localhost:3000`) only works locally. In production Vercel serves a static build, so the frontend must call the Render URL directly.

### 2c. Commit everything to GitHub

```bash
git init          # if not already a git repo
git add .
git commit -m "chore: prepare for deployment"
```

Push to a new GitHub repo (public or private — both work).

---

## Step 3 — Deploy backend to Render

1. Go to [render.com](https://render.com) and sign up (free).
2. **New → Web Service** → connect your GitHub repo.
3. Settings:
   | Field | Value |
   |---|---|
   | **Root Directory** | `backend` |
   | **Runtime** | `Node` |
   | **Build Command** | `npm install` |
   | **Start Command** | `node server.js` |
   | **Instance Type** | Free |
4. Under **Environment** add these variables:
   | Key | Value |
   |---|---|
   | `MONGODB_URI` | Your Atlas connection string from Step 1 |
   | `PORT` | `3000` |
   | `FRONTEND_URL` | *(leave blank for now — add after Step 4)* |
5. Click **Create Web Service**. Render will build and deploy. After a minute you'll get a URL like `https://habit-tracker-backend.onrender.com`.
6. Test it: open `https://<your-render-url>/api/habits` in a browser — it should return `{}` or your existing data.

---

## Step 4 — Deploy frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub (free).
2. **Add New → Project** → import your GitHub repo.
3. Settings:
   | Field | Value |
   |---|---|
   | **Root Directory** | `frontend` |
   | **Framework Preset** | Vite |
   | **Build Command** | `npm run build` |
   | **Output Directory** | `dist` |
4. Under **Environment Variables** add:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://<your-render-url>` (no trailing slash, no `/api`) |
5. Click **Deploy**. After ~1 min you'll get a URL like `https://habit-tracker.vercel.app`.

---

## Step 5 — Wire CORS back to Render

1. Go back to Render → your backend service → **Environment**.
2. Add / update:
   | Key | Value |
   |---|---|
   | `FRONTEND_URL` | `https://habit-tracker.vercel.app` |
3. Render will redeploy automatically.

---

## Step 6 — Verify end-to-end

1. Open your Vercel URL on your phone.
2. Log a habit entry.
3. Refresh — the entry should persist (it's hitting Render → Atlas).
4. Check MongoDB Atlas → **Collections** — you should see your data there.

---

## Summary

| Service | What it hosts | Free limits |
|---|---|---|
| MongoDB Atlas M0 | Database | 512 MB storage, shared cluster |
| Render free | Express API | 750 hrs/month, sleeps after 15 min idle |
| Vercel free | React frontend | Unlimited static deploys, 100 GB bandwidth |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Frontend shows network error | `VITE_API_URL` wrong or missing | Check Vercel env vars, redeploy |
| Backend returns 500 | Bad MongoDB URI or wrong password | Check Render env vars, check Atlas Network Access |
| CORS error in browser | `FRONTEND_URL` not set on Render | Add it in Render env vars |
| First load takes 40 s | Render cold start | Normal on free tier; open the app once to wake it |
| Data not saving | Wrong Atlas IP allowlist | Set `0.0.0.0/0` in Atlas Network Access |

---

*Last updated: April 2026*

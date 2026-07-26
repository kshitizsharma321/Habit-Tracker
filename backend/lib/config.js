// Single source of truth for "where am I running, and what is configured".
//
// The rule this module enforces: **a missing setting must never silently fall
// back to localhost in production.** That failure mode is invisible until a
// user hits it — a password-reset email linking to http://localhost:5173, or a
// CORS allowlist that rejects the real frontend. In development the localhost
// defaults are convenient; in production they are always wrong, so here they
// become a startup failure with the exact fix printed.

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_TEST = NODE_ENV === 'test';

const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:4173'];

function fail(message, fix) {
  console.error(`\n❌ Configuration error: ${message}`);
  if (fix) console.error(`   Fix: ${fix}`);
  console.error('');
  process.exit(1);
}

// FRONTEND_URL accepts a comma-separated list so Vercel preview deployments (or
// a local frontend pointed at the deployed API) can be allowed alongside the
// production URL. The FIRST entry is canonical — it is what gets baked into
// emailed links; the rest only widen the CORS allowlist.
function parseFrontendUrls() {
  const raw = (process.env.FRONTEND_URL || '').trim();

  if (!raw) {
    if (IS_PRODUCTION) {
      fail(
        'FRONTEND_URL is required when NODE_ENV=production.',
        'Set it to your deployed frontend origin, e.g. https://habit-tracker.vercel.app\n' +
        '        (Render → your service → Environment). Without it CORS would reject the\n' +
        '        real frontend and password-reset emails would link to localhost.'
      );
    }
    return DEV_ORIGINS;
  }

  const urls = raw
    .split(',')
    .map((u) => u.trim().replace(/\/+$/, '')) // tolerate trailing slashes
    .filter(Boolean);

  if (!urls.length) fail('FRONTEND_URL is set but contains no usable URL.');

  for (const url of urls) {
    if (!/^https?:\/\//.test(url)) {
      fail(
        `FRONTEND_URL entry "${url}" is missing a scheme.`,
        'Include the protocol — https://habit-tracker.vercel.app, not habit-tracker.vercel.app'
      );
    }
    if (IS_PRODUCTION && url.startsWith('http://') && !url.includes('localhost')) {
      console.warn(`⚠️  FRONTEND_URL "${url}" uses http:// in production — emailed links will be insecure.`);
    }
  }
  return urls;
}

const FRONTEND_URLS = parseFrontendUrls();

// Canonical public origin — used to build links that end up in emails.
const FRONTEND_URL = FRONTEND_URLS[0];

// Every integration is optional and the app degrades to a working state without
// any of them. These let routes and the startup banner agree on what is live.
const features = {
  google: !!process.env.GOOGLE_CLIENT_ID,
  push: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
  supabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  ai: !!process.env.GEMINI_API_KEY,
  email: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
};

// Printed once at boot. On Render this is the fastest way to answer "did that
// environment variable actually take effect?" without redeploying to add a log.
function logStartupSummary() {
  if (IS_TEST) return;
  const label = IS_PRODUCTION ? '🚀 PRODUCTION' : '🛠  DEVELOPMENT';
  const mark = (on) => (on ? '✅' : '⬜');
  const extra = FRONTEND_URLS.length > 1 ? ` (+${FRONTEND_URLS.length - 1} more allowed)` : '';

  console.log(`\n${label}  ·  NODE_ENV=${NODE_ENV}`);
  console.log(`   Frontend origin : ${FRONTEND_URL}${extra}`);
  console.log(`   Integrations    : ${mark(features.google)} Google  ${mark(features.email)} Email  ${mark(features.push)} Push  ${mark(features.ai)} AI  ${mark(features.supabase)} Backups`);

  // Warn only where a missing piece silently disables something an operator
  // running in production probably expects to work.
  if (IS_PRODUCTION) {
    if (!features.email) console.warn('   ⚠️  Email off — "Forgot password?" silently does nothing (admin reset still works)');
    if (!features.supabase) console.warn('   ⚠️  Supabase off — the nightly backup job will NOT run');
    if (!features.google) console.warn('   ⚠️  GOOGLE_CLIENT_ID unset — Google Sign-In is rejected server-side');
    if (!features.push) console.warn('   ⚠️  VAPID keys unset — push reminders are disabled');
  }
  console.log('');
}

module.exports = {
  NODE_ENV,
  IS_PRODUCTION,
  IS_TEST,
  FRONTEND_URL,
  FRONTEND_URLS,
  features,
  logStartupSummary,
};

// All user-facing date logic runs in IST (Asia/Kolkata) — the server itself runs in UTC
// on Render, so every "what day is it" question MUST go through these helpers.

const TIMEZONE = 'Asia/Kolkata';
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// YYYY-MM-DD key for a date, in IST. en-CA locale formats as YYYY-MM-DD.
function getISTDateKey(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

// Strict YYYY-MM-DD check that also rejects impossible dates like 2026-02-31.
function isValidDateKey(key) {
  if (typeof key !== 'string' || !DATE_KEY_RE.test(key)) return false;
  const parsed = new Date(`${key}T00:00:00Z`);
  return !isNaN(parsed) && parsed.toISOString().slice(0, 10) === key;
}

module.exports = { TIMEZONE, DAY_MS, getISTDateKey, isValidDateKey };

// Server-side streak calculation, mirroring the frontend semantics:
//  - walks real calendar days (IST) — a skipped day breaks the streak
//  - today not yet logged does NOT zero the streak (counting starts yesterday)
//  - completion success = 'yes'; quantity success honors goal.direction

const { getISTDateKey, DAY_MS } = require('./dates');

function isSuccess(definition, value) {
  if (definition.trackingType === 'completion') return value === 'yes';
  if (typeof value !== 'number' || isNaN(value)) return false;
  const goalValue = definition.goal?.value;
  if (!goalValue) return value > 0;
  return definition.goal.direction === 'at_most' ? value <= goalValue : value >= goalValue;
}

// entryMap: { 'YYYY-MM-DD': value }
function calculateCurrentStreak(entryMap, definition) {
  const todayKey = getISTDateKey();
  let cursor = new Date();
  if (entryMap[todayKey] === undefined) cursor = new Date(cursor.getTime() - DAY_MS);

  let streak = 0;
  for (;;) {
    const value = entryMap[getISTDateKey(cursor)];
    if (value === undefined || !isSuccess(definition, value)) break;
    streak++;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

// All-time success rate, mirroring the frontend exactly so the Dashboard and the
// Detail page can never disagree. The Dashboard only receives a 60-day entry
// window, so computing this client-side there silently produced a "last 60 days"
// number while Detail (which fetches full history) showed the all-time one.
//
// Semantics per type, matching frontend/src/utils/stats:
//  - completion: gaps between the first entry and today count as misses
//    (fillMissingDays), today excluded while unlogged — a day you haven't
//    reached yet isn't a failure.
//  - quantity: only logged days count; unlogged days are not misses.
function calculateSuccessRate(entryMap, definition) {
  const dates = Object.keys(entryMap).sort();
  if (dates.length === 0) return 0;

  const todayKey = getISTDateKey();

  if (definition.trackingType !== 'completion') {
    const values = Object.values(entryMap).filter((v) => typeof v === 'number');
    if (!values.length) return 0;
    const met = values.filter((v) => isSuccess(definition, v)).length;
    return Math.round((met / values.length) * 100);
  }

  let total = 0;
  let successes = 0;
  const cursor = new Date(`${dates[0]}T00:00:00.000Z`);
  const end = new Date(`${todayKey}T00:00:00.000Z`);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    const value = entryMap[key];
    // An unlogged today is pending, not a miss (mirrors fillMissingDays).
    if (!(key === todayKey && value === undefined)) {
      total++;
      if (isSuccess(definition, value)) successes++;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return total ? Math.round((successes / total) * 100) : 0;
}

module.exports = { calculateCurrentStreak, isSuccess, calculateSuccessRate };

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

// THE single definition of "days tracked" and "success rate", mirroring
// frontend/src/utils/stats exactly. Every surface — dashboard, detail page, AI
// prompts — must use this, or the same habit reports different numbers in
// different places (which is precisely what happened: the AI summary divided by
// raw logged days while the UI divided by the gap-filled calendar span, so a
// habit showing "37 days tracked · 81%" was described by the coach as
// "34 logged days" at an inflated rate).
//
// Semantics per type:
//  - completion: every calendar day from the first entry to today counts, so a
//    skipped day is a miss (mirrors fillMissingDays). An unlogged TODAY is
//    excluded — a day you haven't finished yet isn't a failure.
//  - quantity: only logged days count; gaps are not misses (the frontend does
//    not gap-fill quantity habits either).
function calculateHabitStats(entryMap, definition) {
  const dates = Object.keys(entryMap).sort();
  const daysLogged = dates.length;
  if (daysLogged === 0) return { daysTracked: 0, daysLogged: 0, successDays: 0, successRatePercent: 0 };

  const todayKey = getISTDateKey();

  if (definition.trackingType !== 'completion') {
    const values = Object.values(entryMap).filter((v) => typeof v === 'number');
    const successDays = values.filter((v) => isSuccess(definition, v)).length;
    return {
      daysTracked: values.length,
      daysLogged,
      successDays,
      successRatePercent: values.length ? Math.round((successDays / values.length) * 100) : 0,
    };
  }

  let daysTracked = 0;
  let successDays = 0;
  const cursor = new Date(`${dates[0]}T00:00:00.000Z`);
  const end = new Date(`${todayKey}T00:00:00.000Z`);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    const value = entryMap[key];
    if (!(key === todayKey && value === undefined)) {
      daysTracked++;
      if (isSuccess(definition, value)) successDays++;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return {
    daysTracked,
    daysLogged,
    successDays,
    successRatePercent: daysTracked ? Math.round((successDays / daysTracked) * 100) : 0,
  };
}

function calculateSuccessRate(entryMap, definition) {
  return calculateHabitStats(entryMap, definition).successRatePercent;
}

module.exports = { calculateCurrentStreak, isSuccess, calculateSuccessRate, calculateHabitStats };

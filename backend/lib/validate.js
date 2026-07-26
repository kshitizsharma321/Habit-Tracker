// Shared entry-value validation — the single source of truth for what may be
// written into Habit.value. Every write path (entry route, CSV restore) uses this.

// Returns { ok: true, value } with the normalized value, or { ok: false, error }.
function normalizeEntryValue(trackingType, value) {
  if (trackingType === 'completion') {
    if (value === 'yes' || value === 'no') return { ok: true, value };
    return { ok: false, error: 'Completion habits require "yes" or "no"' };
  }
  if (typeof value !== 'number' || !isFinite(value) || value < 0) {
    return { ok: false, error: 'Quantity habits require a non-negative number' };
  }
  return { ok: true, value: Math.round(value * 100) / 100 };
}

module.exports = { normalizeEntryValue };

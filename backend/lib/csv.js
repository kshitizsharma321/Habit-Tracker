// CSV helpers + the shared per-user backup builder.
// Used by the nightly backup cron (server.js) and the admin routes (generate/restore).

const User = require('../models/User');
const Habit = require('../models/Habit');
const HabitDefinition = require('../models/HabitDefinition');

const BACKUP_HEADERS = [
  'Username', 'Habit Name', 'Tracking Type', 'Unit', 'Color', 'Icon',
  'Goal Enabled', 'Goal Value', 'Goal Direction', 'Date', 'Value',
];

function escapeCsvCell(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

// Quote-aware line parser — the inverse of escapeCsvCell. Handles commas inside
// quoted cells and doubled ("") escaped quotes, which a naive split(',') corrupts.
function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cell);
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

// Builds the full backup CSV for one user.
// Returns { csv, habitCount, entryCount } — or null when there is nothing to back up.
async function buildUserBackupCsv(userId) {
  const user = await User.findById(userId);
  if (!user) return null;

  const definitions = await HabitDefinition.find({ userId }).sort({ order: 1 });
  if (definitions.length === 0) return null;

  const username = user.username || user.email || String(user._id);
  const rows = [BACKUP_HEADERS];
  let entryCount = 0;

  const entries = await Habit.find({ userId }).sort({ date: 1 }).lean();
  const byHabit = new Map();
  for (const e of entries) {
    if (!e.habitId) continue;
    const key = String(e.habitId);
    if (!byHabit.has(key)) byHabit.set(key, []);
    byHabit.get(key).push(e);
  }

  for (const def of definitions) {
    for (const e of byHabit.get(String(def._id)) ?? []) {
      rows.push([
        escapeCsvCell(username),
        escapeCsvCell(def.name),
        escapeCsvCell(def.trackingType),
        escapeCsvCell(def.unit || ''),
        escapeCsvCell(def.color || ''),
        escapeCsvCell(def.icon || ''),
        escapeCsvCell(def.goal?.enabled ? 'true' : 'false'),
        escapeCsvCell(def.goal?.enabled ? def.goal.value : ''),
        escapeCsvCell(def.goal?.enabled ? (def.goal.direction || 'at_least') : ''),
        e.date,
        escapeCsvCell(String(e.value)),
      ]);
      entryCount++;
    }
  }

  if (entryCount === 0) return null;
  return {
    csv: rows.map((r) => r.join(',')).join('\n'),
    habitCount: definitions.length,
    entryCount,
  };
}

module.exports = { escapeCsvCell, parseCsvLine, buildUserBackupCsv, BACKUP_HEADERS };

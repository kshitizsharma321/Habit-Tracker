import { getDateKey, parseStoredDate, dateFormatters } from './dates';

export function getSortedKeys(habitData) {
  return Object.keys(habitData).sort(
    (a, b) => parseStoredDate(a) - parseStoredDate(b),
  );
}

/**
 * Fill date gaps between the first recorded entry and yesterday with 'no'
 * (in memory only — not synced to server unless the user actually saves).
 *
 * Today is intentionally excluded so the streak counter is not zeroed at
 * midnight before the user has had a chance to log.
 */
export function fillMissingDays(habitData) {
  const keys = getSortedKeys(habitData);
  if (keys.length === 0) return habitData;

  const filled = { ...habitData };
  const firstDate = parseStoredDate(keys[0]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = getDateKey(today);

  const cur = new Date(firstDate);
  while (cur <= today) {
    const key = getDateKey(cur);
    // Skip today — leave it unlogged so the streak isn't broken at midnight
    if (!filled[key] && key !== todayKey) {
      filled[key] = 'no';
    }
    cur.setDate(cur.getDate() + 1);
  }
  return filled;
}

/**
 * Calculate current and longest streaks.
 *
 * Key fix: today's entry may be absent (user hasn't logged yet). In that case
 * we start counting from yesterday so the streak doesn't reset to 0 at
 * midnight.
 */
export function calculateStreaks(habitData) {
  const keys = getSortedKeys(habitData);
  if (keys.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const todayKey = getDateKey(new Date());
  const todayVal = habitData[todayKey];

  // Start from yesterday if today is not yet answered
  let startIndex = keys.length - 1;
  if (!todayVal && keys[keys.length - 1] === todayKey) {
    startIndex = keys.length - 2;
  }

  let currentStreak = 0;
  for (let i = startIndex; i >= 0; i--) {
    if (habitData[keys[i]] === 'yes') {
      currentStreak++;
    } else {
      break; // 'no' ends the streak
    }
  }

  let longestStreak = 0;
  let tempStreak = 0;
  for (const key of keys) {
    const val = habitData[key];
    if (val === 'yes') {
      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  }

  return { currentStreak, longestStreak };
}

export function getStats(habitData) {
  const keys = getSortedKeys(habitData);
  const totalDays = keys.length;
  const successDays = keys.filter((k) => habitData[k] === 'yes').length;
  const successRate =
    totalDays > 0 ? Math.round((successDays / totalDays) * 100) : 0;
  const { currentStreak, longestStreak } = calculateStreaks(habitData);
  return { totalDays, successDays, successRate, currentStreak, longestStreak };
}

export function getWeekData(habitData) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  let total = 0;
  let completed = 0;
  const cur = new Date(startOfWeek);
  while (cur <= today) {
    total++;
    if (habitData[getDateKey(cur)] === 'yes') completed++;
    cur.setDate(cur.getDate() + 1);
  }
  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export function getMonthData(habitData) {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  let total = 0;
  let completed = 0;
  const cur = new Date(startOfMonth);
  while (cur <= today) {
    total++;
    if (habitData[getDateKey(cur)] === 'yes') completed++;
    cur.setDate(cur.getDate() + 1);
  }
  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export function getAdvancedStats(habitData) {
  const keys = getSortedKeys(habitData);
  const last30 = keys.slice(-30);
  const last7 = keys.slice(-7);

  const weeklyAverage = _calcAvg(last7, habitData);
  const monthlyAverage = _calcAvg(last30, habitData);
  const consistencyScore = _calcConsistency(keys, habitData);
  const missedDaysThisMonth = last30.filter((k) => habitData[k] === 'no').length;

  const insights = [];
  if (weeklyAverage > monthlyAverage + 5) {
    insights.push("⬆️ You're improving! This week beats your monthly average.");
  } else if (weeklyAverage < monthlyAverage - 5) {
    insights.push('⬇️ This week is below your monthly average. Get back on track!');
  } else {
    insights.push('➡️ Consistent pace — keep it steady!');
  }

  if (consistencyScore > 80) {
    insights.push('🏆 Excellent consistency. The habit is becoming automatic.');
  } else if (consistencyScore > 60) {
    insights.push('👍 Good consistency. Try to push it even higher.');
  } else {
    insights.push('💡 Focus on showing up every day, even briefly.');
  }

  return {
    weeklyAverage,
    monthlyAverage,
    consistencyScore,
    missedDaysThisMonth,
    insights,
  };
}

function _calcAvg(keys, habitData) {
  if (!keys.length) return 0;
  return Math.round(
    (keys.filter((k) => habitData[k] === 'yes').length / keys.length) * 100,
  );
}

function _calcConsistency(keys, habitData) {
  if (keys.length < 7) return 0;
  const last30 = keys.slice(-30);
  const weeks = [];
  for (let i = 0; i < last30.length; i += 7) {
    const week = last30.slice(i, i + 7);
    weeks.push(week.filter((k) => habitData[k] === 'yes').length);
  }
  if (!weeks.length) return 0;
  const avg = weeks.reduce((a, b) => a + b, 0) / weeks.length;
  const variance =
    weeks.reduce((acc, w) => acc + Math.pow(w - avg, 2), 0) / weeks.length;
  return Math.max(0, Math.round((1 - variance / 49) * 100));
}

/**
 * Download habit data as a CSV file.
 * Fixes the memory leak by revoking the object URL after click.
 */
export function downloadCSV(habitData) {
  const keys = getSortedKeys(habitData);
  if (keys.length === 0) {
    alert('No data to export yet!');
    return;
  }

  const rows = [['Date', 'Response', 'Day of Week']];
  keys.forEach((key) => {
    const date = parseStoredDate(key);
    const formatted = date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dow = date.toLocaleDateString('en-US', { weekday: 'long' });
    rows.push([formatted, habitData[key], dow]);
  });

  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `habit-tracker-${new Date().toISOString().split('T')[0]}.csv`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Fix: revoke to avoid memory leak
  URL.revokeObjectURL(url);
}

export function groupByMonth(habitData) {
  const keys = getSortedKeys(habitData);
  const groups = {};
  keys.forEach((key) => {
    const date = parseStoredDate(key);
    const monthYear = dateFormatters.monthYear(date);
    if (!groups[monthYear]) groups[monthYear] = [];
    groups[monthYear].push({ key, date, response: habitData[key] });
  });
  return groups;
}

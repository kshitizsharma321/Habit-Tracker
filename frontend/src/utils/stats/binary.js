import { getDateKey, parseStoredDate } from '../dates';
import { getSortedKeys, wilsonScore, ewma } from './shared';

export function calculateStreaks(data) {
  const keys = getSortedKeys(data);
  if (keys.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const todayKey = getDateKey(new Date());
  const todayVal = data[todayKey];

  let startIndex = keys.length - 1;
  if (!todayVal && keys[keys.length - 1] === todayKey) {
    startIndex = keys.length - 2;
  }

  let currentStreak = 0;
  for (let i = startIndex; i >= 0; i--) {
    const val = data[keys[i]];
    if (val === 'yes') {
      currentStreak++;
    } else {
      break;
    }
  }

  let longestStreak = 0;
  let tempStreak = 0;
  for (const key of keys) {
    const val = data[key];
    if (val === 'yes') {
      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  }

  return { currentStreak, longestStreak };
}

export function calculateStreaksFromGoal(entries, goalValue) {
  const binaryEntries = {};
  for (const [date, value] of Object.entries(entries)) {
    binaryEntries[date] = typeof value === 'number' && value >= goalValue ? 'yes' : 'no';
  }
  return calculateStreaks(binaryEntries);
}

export function getBinaryStats(data) {
  const keys = getSortedKeys(data);
  const totalDays = keys.length;
  const successDays = keys.filter((k) => data[k] === 'yes').length;
  const successRate = totalDays > 0 ? Math.round((successDays / totalDays) * 100) : 0;
  const { currentStreak, longestStreak } = calculateStreaks(data);
  return { totalDays, successDays, successRate, currentStreak, longestStreak };
}

export function getWeekData(data) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  let total = 0, completed = 0;
  const cur = new Date(startOfWeek);
  while (cur <= today) {
    total++;
    if (data[getDateKey(cur)] === 'yes') completed++;
    cur.setDate(cur.getDate() + 1);
  }
  return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

export function getMonthData(data) {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  let total = 0, completed = 0;
  const cur = new Date(startOfMonth);
  while (cur <= today) {
    total++;
    if (data[getDateKey(cur)] === 'yes') completed++;
    cur.setDate(cur.getDate() + 1);
  }
  return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

export function getAdvancedStats(data) {
  const keys = getSortedKeys(data);
  const last30 = keys.slice(-30);
  const last7 = keys.slice(-7);

  const weeklyAverage = _calcAvg(last7, data);
  const monthlyAverage = _calcAvg(last30, data);
  const consistencyScore = _calcConsistency(keys, data);
  const missedDaysThisMonth = last30.filter((k) => data[k] === 'no').length;

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

  return { weeklyAverage, monthlyAverage, consistencyScore, missedDaysThisMonth, insights };
}

function _calcAvg(keys, data) {
  if (!keys.length) return 0;
  return Math.round(
    (keys.filter((k) => data[k] === 'yes').length / keys.length) * 100,
  );
}

function _calcConsistency(keys, data) {
  if (keys.length < 7) return 0;
  // Wilson Score lower bound: confidence-adjusted success rate that penalises small samples
  const successes = keys.filter((k) => data[k] === 'yes').length;
  return Math.round(wilsonScore(successes, keys.length) * 100);
}

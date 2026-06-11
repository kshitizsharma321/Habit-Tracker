import { getSortedKeys, ewma } from './shared';
import { parseStoredDate, getDateKey } from '../dates';
import { getNumericStats, getNumericTrend, getZScoreAnomalies } from './numeric';

/**
 * Generate smart insights for a habit based on its tracking type and data.
 * Returns max 5 most significant insights.
 */
const insightGenerators = {
  completion: _binaryInsights,
  quantity: _numericInsights,
};

export function getInsights(entries, definition) {
  const insights = [];

  if (!definition) return insights;
  const { trackingType, name, goal } = definition;

  const generator = insightGenerators[trackingType];
  if (generator) {
    insights.push(...generator(entries, name));
  }

  // Day-of-week analysis (works for any type)
  const dayInsight = _dayOfWeekInsight(entries, name, trackingType);
  if (dayInsight) insights.push(dayInsight);

  // Goal progress
  if (goal?.enabled) {
    const goalInsight = _goalInsight(entries, name, goal, trackingType);
    if (goalInsight) insights.push(goalInsight);
  }

  // Deduplicate: remove exact duplicates, then also remove same-leading-emoji duplicates
  const seen = new Set();
  const usedEmoji = new Set();
  const unique = [];
  for (const insight of insights) {
    if (seen.has(insight)) continue;
    seen.add(insight);
    // Extract the leading grapheme (handles multi-codepoint emojis)
    const firstChar = [...insight][0] ?? '';
    if (usedEmoji.has(firstChar)) continue;
    usedEmoji.add(firstChar);
    unique.push(insight);
  }
  return unique.slice(0, 5);
}

function _binaryInsights(entries, name) {
  const insights = [];
  const keys = getSortedKeys(entries);
  const yesDays = keys.filter((k) => entries[k] === 'yes').length;
  const total = keys.filter((k) => entries[k] === 'yes' || entries[k] === 'no').length;
  const rate = total > 0 ? Math.round((yesDays / total) * 100) : 0;

  // Success rate categories
  if (rate >= 90 && total >= 7) {
    insights.push(`🏆 Outstanding! You've maintained a ${rate}% success rate on "${name}"`);
  } else if (rate >= 70) {
    insights.push(`💪 Solid ${rate}% success rate on "${name}" — keep building momentum`);
  }

  // Trend via EWMA (exponentially weighted — more responsive to recent changes)
  if (keys.length >= 10) {
    const dailyBinary = keys.map((k) => (entries[k] === 'yes' ? 1 : 0));
    const smoothed = ewma(dailyBinary, 0.25);
    const lookback = Math.min(7, smoothed.length - 1);
    const change = smoothed.at(-1) - smoothed[smoothed.length - 1 - lookback];
    if (change > 0.08) {
      insights.push(`📈 "${name}" consistency is trending upward lately (+${Math.round(change * 100)}%)`);
    } else if (change < -0.08) {
      insights.push(`📉 "${name}" consistency has dipped recently`);
    }
  }

  return insights;
}

function _numericInsights(entries, name) {
  const insights = [];
  const stats = getNumericStats(entries);

  if (stats.count < 3) return insights;

  insights.push(`📊 Avg: ${stats.avg} | Min: ${stats.min} | Max: ${stats.max}`);

  // Personal best via Z-score outlier detection
  const anomalies = getZScoreAnomalies(entries);
  const highs = anomalies.filter((a) => a.zScore > 0);
  if (highs.length > 0) {
    const best = highs.reduce((a, b) => (entries[a.date] > entries[b.date] ? a : b));
    insights.push(`🌟 Personal best: ${entries[best.date]} on ${best.date}`);
  }

  const trend = getNumericTrend(entries);
  if (trend.direction === 'up') {
    insights.push(`📈 "${name}" is trending up (+${trend.changePercent}%)`);
    if (trend.forecast !== null) {
      insights.push(`🔮 Based on your trend, you may reach ~${trend.forecast} within a week`);
    }
  } else if (trend.direction === 'down') {
    insights.push(`📉 "${name}" has been decreasing (${trend.changePercent}%) — time to push back!`);
  } else if (trend.direction === 'steady' && stats.count >= 7) {
    insights.push(`➡️ Steady performance on "${name}" — consistent effort pays off`);
  }

  return insights;
}

function _dayOfWeekInsight(entries, name, trackingType) {
  const keys = getSortedKeys(entries);
  if (keys.length < 14) return null;

  const dayMap = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const dayCount = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (const key of keys) {
    const date = parseStoredDate(key);
    const day = date.getDay();
    dayCount[day]++;

    if (trackingType === 'completion') {
      if (entries[key] === 'yes') dayMap[day]++;
    } else if (trackingType === 'quantity') {
      if (typeof entries[key] === 'number' && entries[key] > 0) dayMap[day]++;
    }
  }

  // Find best and worst days with significant difference
  let bestDay = null, worstDay = null, bestRate = 0, worstRate = 1;
  const rates = [];

  for (let d = 0; d < 7; d++) {
    if (dayCount[d] >= 3) {
      const rate = dayMap[d] / dayCount[d];
      rates.push({ day: d, rate, count: dayCount[d] });
      if (rate > bestRate) { bestRate = rate; bestDay = d; }
      if (rate < worstRate) { worstRate = rate; worstDay = d; }
    }
  }

  if (bestDay !== null && worstDay !== null && bestDay !== worstDay && bestRate - worstRate > 0.2) {
    return `📅 You perform best on ${dayNames[bestDay]}s (${Math.round(bestRate * 100)}%) and lowest on ${dayNames[worstDay]}s (${Math.round(worstRate * 100)}%) for "${name}"`;
  }

  return null;
}

function _goalInsight(entries, name, goal, trackingType) {
  if (trackingType !== 'quantity') return null;
  const todayKey = getDateKey(new Date());
  const val = entries?.[todayKey];
  if (typeof val !== 'number') return null;
  if (val >= goal.value) return `✅ Goal met for "${name}"! (${val}/${goal.value})`;
  const percent = Math.round((val / goal.value) * 100);
  return `🎯 ${val}/${goal.value} (${percent}%) toward today's "${name}" goal`;
}

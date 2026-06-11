import { getSortedKeys, ewma } from './shared';
import { getDateKey } from '../dates';
import { linearRegression } from './regression';

export function getNumericStats(data) {
  const values = Object.values(data)
    .filter((v) => typeof v === 'number' && !isNaN(v));

  if (values.length === 0) {
    return { count: 0, avg: 0, min: 0, max: 0, total: 0, median: 0, stdDev: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const count = values.length;
  const total = values.reduce((a, b) => a + b, 0);
  const avg = +(total / count).toFixed(2);
  const min = sorted[0];
  const max = sorted[count - 1];
  const mid = Math.floor(count / 2);
  const median = count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const variance = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / count;
  const stdDev = +Math.sqrt(variance).toFixed(2);

  return { count, avg, min, max, total: +total.toFixed(2), median, stdDev };
}

export function getMovingAverage(data, window = 7) {
  const keys = getSortedKeys(data);
  const numeric = keys
    .map((k) => data[k])
    .filter((v) => typeof v === 'number' && !isNaN(v));

  if (numeric.length < window) return [];

  const result = [];
  for (let i = window - 1; i < numeric.length; i++) {
    const slice = numeric.slice(i - window + 1, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / window;
    result.push(+avg.toFixed(2));
  }
  return result;
}

export function getNumericTrend(data) {
  const keys = getSortedKeys(data);
  const pairs = keys
    .map((k) => data[k])
    .filter((v) => typeof v === 'number' && !isNaN(v));

  if (pairs.length < 5) {
    return { direction: 'insufficient', changePercent: 0, slope: 0, forecast: null };
  }

  const reg = linearRegression(pairs);
  // EWMA confirmation: compare last smoothed value to value 7 steps ago
  const smoothed = ewma(pairs, 0.2);
  const ewmaSlope = smoothed.length >= 7
    ? smoothed.at(-1) - smoothed[smoothed.length - 7]
    : 0;
  const ewmaConfirms = reg.trend === 'improving' ? ewmaSlope > 0 : reg.trend === 'declining' ? ewmaSlope < 0 : true;

  // Dampen weak linear signals that EWMA doesn't confirm
  const direction = !ewmaConfirms && Math.abs(reg.percentageChange) < 15
    ? 'steady'
    : reg.trend === 'improving' ? 'up' : reg.trend === 'declining' ? 'down' : 'steady';

  return {
    direction,
    changePercent: reg.percentageChange,
    slope: +reg.slope.toFixed(4),
    rSquared: +reg.rSquared.toFixed(3),
    forecast: reg.predict ? +reg.predict(pairs.length + 6).toFixed(2) : null,
  };
}

/**
 * Returns dates where the value is a statistical outlier (|z-score| > 2).
 * Requires at least 5 data points for meaningful results.
 */
export function getZScoreAnomalies(data) {
  const keys = getSortedKeys(data).filter((k) => typeof data[k] === 'number' && !isNaN(data[k]));
  if (keys.length < 5) return [];
  const values = keys.map((k) => data[k]);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  if (std === 0) return [];
  return keys
    .map((k) => ({ date: k, value: data[k], zScore: (data[k] - mean) / std }))
    .filter((a) => Math.abs(a.zScore) > 2);
}

/**
 * Coefficient of Variation (stdDev / mean * 100).
 * Low = very consistent, high = erratic.
 */
export function getCoefficientOfVariation(data) {
  const stats = getNumericStats(data);
  if (stats.count < 3 || stats.avg === 0) return null;
  return Math.round((stats.stdDev / stats.avg) * 100);
}

export function getWeekNumericData(data) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const values = [];
  const cur = new Date(startOfWeek);
  while (cur <= today) {
    const key = getDateKey(cur);
    const val = data[key];
    if (typeof val === 'number' && !isNaN(val)) values.push(val);
    cur.setDate(cur.getDate() + 1);
  }

  if (values.length === 0) return { total: 0, avg: 0, days: 0 };
  return {
    total: +values.reduce((a, b) => a + b, 0).toFixed(2),
    avg: +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
    days: values.length,
  };
}

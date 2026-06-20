import { getDateKey, parseStoredDate, dateFormatters } from '../dates';

export function getSortedKeys(data) {
  return Object.keys(data).sort(
    (a, b) => parseStoredDate(a) - parseStoredDate(b),
  );
}

/**
 * Fill date gaps between the first recorded entry and yesterday with a fallback value.
 * Today is intentionally excluded so the streak counter is not zeroed at midnight.
 */
export function fillMissingDays(data, fallback = 'no') {
  const keys = getSortedKeys(data);
  if (keys.length === 0) return data;

  const filled = { ...data };
  const firstDate = parseStoredDate(keys[0]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = getDateKey(today);

  const cur = new Date(firstDate);
  while (cur <= today) {
    const key = getDateKey(cur);
    if (!filled[key] && key !== todayKey) {
      filled[key] = fallback;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return filled;
}

export function downloadCSV(data, filename, columns = ['Date', 'Value', 'Day of Week']) {
  const keys = getSortedKeys(data);
  if (keys.length === 0) {
    alert('No data to export yet!');
    return;
  }

  const rows = [columns];
  keys.forEach((key) => {
    const date = parseStoredDate(key);
    const formatted = date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dow = date.toLocaleDateString('en-US', { weekday: 'long' });
    rows.push([formatted, String(data[key]), dow]);
  });

  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function groupByMonth(data) {
  const keys = getSortedKeys(data);
  const groups = {};
  keys.forEach((key) => {
    const date = parseStoredDate(key);
    const monthYear = dateFormatters.monthYear(date);
    if (!groups[monthYear]) groups[monthYear] = [];
    groups[monthYear].push({ key, date, value: data[key] });
  });
  return groups;
}

/**
 * Exponentially Weighted Moving Average.
 * alpha: 0.1 = very smooth, 0.3 = more responsive to recent changes.
 */
export function ewma(values, alpha = 0.2) {
  if (values.length === 0) return [];
  const result = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(alpha * values[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
}

/**
 * Wilson Score lower confidence bound for a binomial proportion.
 * Penalises small samples — 10/10 is less meaningful than 100/100.
 * z = 1.645 (90% confidence).
 */
export function wilsonScore(successes, total) {
  if (total === 0) return 0;
  const p = successes / total;
  const z = 1.645;
  const numerator =
    p + (z * z) / (2 * total) -
    z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  const denominator = 1 + (z * z) / total;
  return Math.max(0, Math.min(1, numerator / denominator));
}

import { useMemo } from 'react';
import { getDateKey } from '../utils/dates';

export default function GoalsTracker({ entries, definition }) {
  const progress = useMemo(() => {
    const { goal, trackingType, unit } = definition || {};
    if (trackingType !== 'quantity' || !goal?.enabled || !goal.value) return null;

    const todayKey = getDateKey(new Date());
    const todayValue = entries?.[todayKey];
    const unitLabel = unit || '';

    if (todayValue === undefined || todayValue === null) {
      return { todayValue: null, target: goal.value, unit: unitLabel };
    }

    const percent = Math.min(100, Math.round((todayValue / goal.value) * 100));
    const isMet = todayValue >= goal.value;
    return { todayValue, target: goal.value, percent, isMet, unit: unitLabel };
  }, [entries, definition]);

  if (!progress) return null;

  const barColor = progress.todayValue === null
    ? 'var(--border-color)'
    : progress.isMet
      ? 'var(--success-color)'
      : progress.percent > 60
        ? 'var(--accent-color)'
        : 'var(--danger-color)';

  return (
    <div className="bg-card border rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h5 className="font-semibold text-sm text-foreground">
          🎯 Today&apos;s Goal
        </h5>
        {progress.todayValue !== null && (
          <span className="text-sm font-bold text-foreground">{progress.percent}%</span>
        )}
      </div>

      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: progress.todayValue === null ? '0%' : `${progress.percent}%`,
            backgroundColor: barColor,
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        {progress.todayValue === null
          ? `Not logged yet — goal: ${progress.target}${progress.unit ? ` ${progress.unit}` : ''}`
          : progress.isMet
            ? `🎉 Goal met! ${progress.todayValue}/${progress.target}${progress.unit ? ` ${progress.unit}` : ''}`
            : `${progress.todayValue}/${progress.target}${progress.unit ? ` ${progress.unit}` : ''} — ${progress.target - progress.todayValue} ${progress.unit || 'more'} to go`}
      </p>
    </div>
  );
}

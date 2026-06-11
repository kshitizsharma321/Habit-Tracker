import { getTypeStats } from '../utils/stats';

function StatCard({ value, label, color }) {
  return (
    <div
      className="rounded-xl p-4 overflow-hidden relative"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow)',
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ background: color }} />
      <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{value}</p>
      <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
    </div>
  );
}

export default function StatsGrid({ entries, trackingType }) {
  const stats = getTypeStats(entries, trackingType);

  if (trackingType === 'completion') {
    const { totalDays, successDays, successRate, longestStreak } = stats;
    const rateColor =
      successRate >= 80
        ? 'var(--success-color)'
        : successRate >= 50
          ? 'var(--accent-color)'
          : 'var(--danger-color)';

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard value={totalDays} label="Days Tracked" color="var(--accent-color)" />
        <StatCard value={successDays} label="Completed" color="var(--success-color)" />
        <StatCard value={`${successRate}%`} label="Success Rate" color={rateColor} />
        <StatCard value={longestStreak} label="Best Streak" color="#f59e0b" />
      </div>
    );
  }

  if (trackingType === 'quantity') {
    const { count, avg, min, max } = stats;
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard value={count} label="Days Tracked" color="var(--accent-color)" />
        <StatCard value={avg} label="Average" color="var(--accent-color)" />
        <StatCard value={min} label="Min" color="var(--danger-color)" />
        <StatCard value={max} label="Max" color="var(--success-color)" />
      </div>
    );
  }

  return null;
}

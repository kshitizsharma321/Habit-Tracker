import { getStats } from '../utils/stats';

function StatCard({ value, label }) {
  return (
    <div className="ht-card p-4 text-center">
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      <p className="text-sm text-text-secondary mt-1">{label}</p>
    </div>
  );
}

export default function StatsGrid({ habitData }) {
  const { totalDays, successDays, successRate, longestStreak } =
    getStats(habitData);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <StatCard value={totalDays} label="Days Tracked" />
      <StatCard value={successDays} label="Successful Days" />
      <StatCard value={`${successRate}%`} label="Success Rate" />
      <StatCard value={longestStreak} label="Longest Streak" />
    </div>
  );
}

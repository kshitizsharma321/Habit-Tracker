import { getAdvancedStats } from '../utils/stats';

function StatCard({ value, label }) {
  return (
    <div className="ht-card p-4 text-center">
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      <p className="text-sm text-text-secondary mt-1">{label}</p>
    </div>
  );
}

export default function AdvancedStatsModal({ isOpen, habitData, onClose }) {
  if (!isOpen) return null;

  const { weeklyAverage, monthlyAverage, consistencyScore, missedDaysThisMonth, insights } =
    getAdvancedStats(habitData);

  return (
    <div
      className="ht-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ht-dialog w-full max-w-xl" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-col">
          <h5 className="font-semibold text-text-primary">📈 Advanced Statistics</h5>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-text-secondary hover:text-text-primary text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-2 gap-3 mb-5">
            <StatCard value={`${weeklyAverage}%`} label="Weekly Average" />
            <StatCard value={`${monthlyAverage}%`} label="Monthly Average" />
            <StatCard value={`${consistencyScore}%`} label="Consistency Score" />
            <StatCard value={missedDaysThisMonth} label="Missed (Last 30 Days)" />
          </div>

          <div>
            <h6 className="font-semibold text-text-primary mb-2">
              Performance Insights
            </h6>
            <ul className="space-y-2">
              {insights.map((insight, i) => (
                <li
                  key={i}
                  className="text-sm text-text-secondary bg-bg-secondary rounded-lg px-3 py-2"
                >
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

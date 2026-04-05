import { getWeekData, getMonthData } from '../utils/stats';

function ProgressBar({ label, completed, total, percentage }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="text-sm text-text-secondary">
          {completed}/{total} &mdash; {percentage}%
        </span>
      </div>
      <div className="w-full h-2.5 rounded-full bg-bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full bg-ht-success transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function ProgressBars({ habitData }) {
  const week = getWeekData(habitData);
  const month = getMonthData(habitData);

  return (
    <div className="ht-card p-6">
      <h5 className="font-semibold text-base mb-4 text-text-primary">
        Progress Overview
      </h5>
      <div className="grid md:grid-cols-2 lg:grid-cols-1 gap-4">
        <ProgressBar
          label="This Week"
          completed={week.completed}
          total={week.total}
          percentage={week.percentage}
        />
        <ProgressBar
          label="This Month"
          completed={month.completed}
          total={month.total}
          percentage={month.percentage}
        />
      </div>
    </div>
  );
}

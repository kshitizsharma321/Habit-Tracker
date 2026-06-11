import { useMemo } from 'react';
import { parseStoredDate } from '../utils/dates';
import { getSortedKeys } from '../utils/stats/shared';
import { getAdvancedStats, getWeekData, getMonthData } from '../utils/stats/binary';
import { getNumericStats, getNumericTrend, getWeekNumericData, getCoefficientOfVariation } from '../utils/stats/numeric';

// ── Helpers ────────────────────────────────────────────────────────────────────

function scoreColor(n) {
  if (n >= 75) return 'var(--success-color)';
  if (n >= 50) return '#f59e0b';
  return 'var(--danger-color)';
}

function trendIcon(dir) {
  if (dir === 'up' || dir === 'improving') return '⬆️';
  if (dir === 'down' || dir === 'declining') return '⬇️';
  return '↔️';
}

function dayOfWeekRates(entries, trackingType) {
  const keys = getSortedKeys(entries);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const counts = Array(7).fill(0);
  const hits = Array(7).fill(0);

  for (const k of keys) {
    const d = parseStoredDate(k).getDay();
    counts[d]++;
    const v = entries[k];
    if (trackingType === 'completion' ? v === 'yes' : (typeof v === 'number' && v > 0)) {
      hits[d]++;
    }
  }

  return dayNames.map((name, i) => ({
    name,
    rate: counts[i] >= 2 ? Math.round((hits[i] / counts[i]) * 100) : null,
  }));
}

function getBinaryTips(stats, dayRates) {
  const tips = [];
  const { successRate, consistencyScore, weeklyAverage, monthlyAverage, missedDaysThisMonth } = stats;
  const validDays = dayRates.filter((d) => d.rate !== null);
  const worst = validDays.length ? validDays.reduce((a, b) => (b.rate < a.rate ? b : a)) : null;

  if (successRate >= 80) {
    tips.push({ icon: '⭐', text: 'Exceptional consistency! Consider increasing the difficulty or adding a stretch goal.' });
  } else if (successRate < 50) {
    tips.push({ icon: '💡', text: 'Focus on showing up rather than perfection. Even a partial effort keeps momentum alive.' });
  }

  if (consistencyScore < 55) {
    tips.push({ icon: '⏰', text: 'Anchor this habit to a fixed time each day — removing the "when?" decision boosts follow-through.' });
  }

  if (weeklyAverage < monthlyAverage - 10) {
    tips.push({ icon: '⬇️', text: 'This week is lagging behind your monthly pace. One strong push now can reverse the trend.' });
  }

  if (missedDaysThisMonth > 8) {
    tips.push({ icon: '🔗', text: `You've missed ${missedDaysThisMonth} days this month. Try habit stacking — attach it to something you already do.` });
  }

  if (worst && worst.rate < 40) {
    tips.push({ icon: '🗓️', text: `${worst.name}s are your hardest day (${worst.rate}% success). Plan something specific for that day.` });
  }

  return tips.slice(0, 3);
}

function getNumericTips(stats, trend) {
  const tips = [];
  const { avg, stdDev, count } = stats;

  if (trend.direction === 'up') {
    tips.push({ icon: '⬆️', text: `You're on an upward trend (+${trend.changePercent}%). Keep it up — consistency drives exponential results.` });
  } else if (trend.direction === 'down') {
    tips.push({ icon: '⬇️', text: 'Numbers are sliding down. Identify if it\'s recovery/rest or a motivation dip.' });
  }

  if (stdDev > avg * 0.5 && count >= 7) {
    tips.push({ icon: '🎢', text: 'High variance in your numbers. Try targeting a minimum floor rather than aiming for a peak each time.' });
  }

  if (count < 14) {
    tips.push({ icon: '📦', text: 'Keep logging consistently — analytics become much more meaningful with 14+ data points.' });
  } else if (trend.forecast !== null && trend.direction === 'up') {
    tips.push({ icon: '🎯', text: `On this trajectory you could hit ~${trend.forecast} within the next 7 days.` });
  }

  return tips.slice(0, 3);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>
      {children}
    </h3>
  );
}

function MetricRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid var(--border-color)' }}>
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-sm font-bold" style={{ color: color || 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function DayChart({ dayRates }) {
  const valid = dayRates.filter((d) => d.rate !== null);
  if (valid.length < 3) return null;

  const maxRate = Math.max(...valid.map((d) => d.rate), 1);
  const best = valid.reduce((a, b) => (b.rate > a.rate ? b : a));
  const worst = valid.reduce((a, b) => (b.rate < a.rate ? b : a));

  return (
    <div>
      <SectionTitle>Day of Week</SectionTitle>
      <div className="flex items-end gap-1.5" style={{ height: '72px' }}>
        {dayRates.map(({ name, rate }) => {
          const isBest = rate !== null && rate === best.rate;
          const isWorst = rate !== null && rate === worst.rate && worst.rate !== best.rate;
          const height = rate !== null ? Math.max(8, Math.round((rate / maxRate) * 64)) : 8;
          const color = isBest ? 'var(--success-color)' : isWorst ? 'var(--danger-color)' : 'var(--accent-color)';
          const opacity = rate === null ? 0.2 : isBest || isWorst ? 1 : 0.55;

          return (
            <div key={name} className="flex flex-col items-center gap-1" style={{ flex: 1 }}>
              <div
                className="rounded-t-sm w-full transition-all"
                style={{ height: `${height}px`, background: color, opacity }}
                title={rate !== null ? `${name}: ${rate}%` : `${name}: no data`}
              />
              <span className="text-[9px] font-semibold" style={{ color: isBest ? 'var(--success-color)' : isWorst ? 'var(--danger-color)' : 'var(--text-secondary)' }}>
                {name}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span style={{ color: 'var(--success-color)' }}>▲ Best: {best.name} ({best.rate}%)</span>
        {worst.rate !== best.rate && (
          <span style={{ color: 'var(--danger-color)' }}>▼ Hardest: {worst.name} ({worst.rate}%)</span>
        )}
      </div>
    </div>
  );
}

function TipsList({ tips }) {
  if (!tips.length) return null;
  return (
    <div>
      <SectionTitle>How to Improve</SectionTitle>
      <div className="flex flex-col gap-2">
        {tips.map((tip, i) => (
          <div
            key={i}
            className="flex gap-2.5 rounded-lg p-3"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
          >
            <span className="text-base flex-shrink-0 mt-0.5">{tip.icon}</span>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{tip.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Completion analytics ───────────────────────────────────────────────────────

function CompletionAnalytics({ entries }) {
  const data = useMemo(() => {
    const keys = getSortedKeys(entries);
    if (keys.length < 3) return null;

    const adv = getAdvancedStats(entries);
    const week = getWeekData(entries);
    const month = getMonthData(entries);
    const dayRates = dayOfWeekRates(entries, 'completion');
    const tips = getBinaryTips(adv, dayRates);

    const weekVsMonth =
      adv.weeklyAverage > adv.monthlyAverage + 5 ? 'up'
      : adv.weeklyAverage < adv.monthlyAverage - 5 ? 'down'
      : 'steady';

    return { adv, week, month, dayRates, tips, weekVsMonth };
  }, [entries]);

  if (!data) {
    return (
      <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
        Log at least 3 days to unlock analytics.
      </p>
    );
  }

  const { adv, week, month, dayRates, tips, weekVsMonth } = data;

  return (
    <div className="space-y-6">
      {/* Period comparison */}
      <div>
        <SectionTitle>Performance</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'This Week', value: week.completed, total: week.total, pct: week.percentage },
            { label: 'This Month', value: month.completed, total: month.total, pct: month.percentage },
          ].map(({ label, value, total, pct }) => (
            <div
              key={label}
              className="rounded-xl p-4"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
            >
              <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</p>
              <p className="text-2xl font-black" style={{ color: scoreColor(pct) }}>{pct}%</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{value}/{total} days</p>
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-color)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: scoreColor(pct) }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
          <span>{trendIcon(weekVsMonth)}</span>
          <span>
            {weekVsMonth === 'up'
              ? `This week is ${adv.weeklyAverage - adv.monthlyAverage}% above your monthly pace`
              : weekVsMonth === 'down'
                ? `This week is ${adv.monthlyAverage - adv.weeklyAverage}% below your monthly pace`
                : 'Matching your monthly pace this week'}
          </span>
        </div>
      </div>

      {/* Consistency score */}
      <div>
        <SectionTitle>Consistency Score</SectionTitle>
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 relative w-16 h-16">
            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border-color)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke={scoreColor(adv.consistencyScore)}
                strokeWidth="3"
                strokeDasharray={`${adv.consistencyScore} ${100 - adv.consistencyScore}`}
                strokeLinecap="round"
              />
            </svg>
            <span
              className="absolute inset-0 flex items-center justify-center text-sm font-black"
              style={{ color: scoreColor(adv.consistencyScore) }}
            >
              {adv.consistencyScore}
            </span>
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              {adv.consistencyScore >= 75 ? 'Rock solid' : adv.consistencyScore >= 50 ? 'Building steadily' : 'Needs attention'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Based on variance in your weekly performance over the last 30 days
            </p>
          </div>
        </div>
      </div>

      {/* Day of week chart */}
      <DayChart dayRates={dayRates} />

      {/* Metrics */}
      <div>
        <SectionTitle>Metrics</SectionTitle>
        <div>
          <MetricRow label="Overall success rate" value={`${adv.monthlyAverage}% (monthly avg)`} />
          <MetricRow label="This week" value={`${adv.weeklyAverage}%`} color={scoreColor(adv.weeklyAverage)} />
          <MetricRow label="Missed this month" value={`${adv.missedDaysThisMonth} days`} color={adv.missedDaysThisMonth > 8 ? 'var(--danger-color)' : 'var(--text-primary)'} />
        </div>
      </div>

      {/* Improvement tips */}
      <TipsList tips={tips} />
    </div>
  );
}

// ── Quantity analytics ─────────────────────────────────────────────────────────

function QuantityAnalytics({ entries, definition }) {
  const data = useMemo(() => {
    const keys = getSortedKeys(entries);
    if (keys.length < 3) return null;

    const stats = getNumericStats(entries);
    const trend = getNumericTrend(entries);
    const week = getWeekNumericData(entries);
    const dayRates = dayOfWeekRates(entries, 'quantity');
    const tips = getNumericTips(stats, trend);
    const cv = getCoefficientOfVariation(entries);

    return { stats, trend, week, dayRates, tips, cv };
  }, [entries]);

  if (!data) {
    return (
      <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>
        Log at least 3 days to unlock analytics.
      </p>
    );
  }

  const { stats, trend, week, dayRates, tips, cv } = data;
  const unit = definition?.unit ? ` ${definition.unit}` : '';

  return (
    <div className="space-y-6">
      {/* Volume */}
      <div>
        <SectionTitle>Volume</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'This week total', value: `${week.total}${unit}`, color: 'var(--accent-color)' },
            { label: 'This week avg/day', value: `${week.avg}${unit}`, color: 'var(--accent-color)' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-xl p-4"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
            >
              <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</p>
              <p className="text-2xl font-black" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Trend */}
      <div>
        <SectionTitle>Trend</SectionTitle>
        <div
          className="flex items-center gap-3 rounded-xl p-4"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
        >
          <span className="text-3xl">{trendIcon(trend.direction)}</span>
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              {trend.direction === 'up' ? `Trending up +${trend.changePercent}%`
                : trend.direction === 'down' ? `Trending down ${trend.changePercent}%`
                : trend.direction === 'insufficient' ? 'Not enough data for trend'
                : 'Steady performance'}
            </p>
            {trend.forecast !== null && trend.direction !== 'steady' && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                7-day forecast: ~{trend.forecast}{unit}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div>
        <SectionTitle>Statistics</SectionTitle>
        <div>
          <MetricRow label="All-time total" value={`${stats.total}${unit}`} />
          <MetricRow label="Median" value={`${stats.median}${unit}`} />
          <MetricRow label="Std deviation" value={`±${stats.stdDev}${unit}`} />
          <MetricRow label="Days tracked" value={`${stats.count} days`} />
          {cv !== null && (
            <MetricRow
              label="Consistency rating"
              value={cv < 20 ? 'Very consistent' : cv < 50 ? 'Consistent' : 'Variable'}
              color={cv < 20 ? 'var(--success-color)' : cv < 50 ? '#f59e0b' : 'var(--danger-color)'}
            />
          )}
        </div>
      </div>

      {/* Day chart */}
      <DayChart dayRates={dayRates} />

      {/* Tips */}
      <TipsList tips={tips} />
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function AnalyticsPanel({ entries, definition }) {
  if (!entries || Object.keys(entries).length < 3) {
    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
      >
        <p className="text-3xl mb-3">🔍</p>
        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Analytics unlock after 3 logged days</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Keep logging to see patterns, trends, and improvement tips.</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow)' }}
    >
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xl">🔍</span>
        <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Analytics</h2>
      </div>

      {definition?.trackingType === 'quantity' ? (
        <QuantityAnalytics entries={entries} definition={definition} />
      ) : (
        <CompletionAnalytics entries={entries} />
      )}
    </div>
  );
}

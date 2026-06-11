import { useMemo, useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { useHabitEntries } from '../hooks/useHabitEntries';
import StreakCalendar from '../components/StreakCalendar/StreakCalendar';
import StatsGrid from '../components/StatsGrid';
import SmartInsights from '../components/SmartInsights';
import AnalyticsPanel from '../components/AnalyticsPanel';
import GoalsTracker from '../components/GoalsTracker';
import History from '../components/History/History';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { downloadCSV, calculateStreaks, calculateStreaksFromGoal } from '../utils/stats';
import { TYPE_LABELS } from '../constants/habits';

// ── Streak messages ────────────────────────────────────────────────────────────
const STREAK_CONFIG = [
  [100, { icon: '🏆', boost: "TRIPLE DIGITS — YOU'RE A LEGEND!", tip: "Only 1% of habit-builders reach this. Rare. Exceptional. Guard it fiercely." }],
  [90,  { icon: '💎', boost: '3 months of pure discipline!', tip: "Diamond-tier consistency. Your identity has shifted — this habit is part of who you are." }],
  [60,  { icon: '🚀', boost: '2 months strong — elite territory!', tip: "Only ~8% hit 60 days. You've done what most only talk about." }],
  [30,  { icon: '🔥', boost: 'One full month — habit officially formed!', tip: "Neuroscience confirms: 30+ days rewires your brain. This habit is yours now." }],
  [21,  { icon: '⚡', boost: '21 days — the momentum is real!', tip: "Three weeks of consistency builds genuine neural momentum. Don't break the chain!" }],
  [14,  { icon: '💪', boost: 'Two weeks of solid commitment!', tip: "You've proven you can do this. The hardest part is behind you — keep going." }],
  [7,   { icon: '🌟', boost: 'One full week — strong foundation!', tip: "Week one is what every great streak is built on. Stack another 7 days!" }],
  [3,   { icon: '✨', boost: '3 days in a row — momentum building!', tip: "Small wins compound into transformational results. Show up again tomorrow." }],
  [1,   { icon: '🎯', boost: 'Day one done — the journey begins!', tip: "Every legendary streak started at 1. The hardest step is the first one." }],
  [0,   { icon: '💡', boost: 'Ready to build your streak?', tip: "Log today and light the fire. Every great streak started exactly here — at zero." }],
];

function getStreakMeta(n) {
  return (STREAK_CONFIG.find(([t]) => n >= t) ?? STREAK_CONFIG.at(-1))[1];
}

// ── Streak banner ──────────────────────────────────────────────────────────────
function StreakBanner({ streak, definition }) {
  const { currentStreak, longestStreak } = streak;
  const meta = getStreakMeta(currentStreak);
  const color = definition?.color || 'var(--accent-color)';
  const isLegendary = currentStreak >= 30;

  return (
    <div
      className="rounded-2xl p-6 relative overflow-hidden"
      style={{
        background: currentStreak === 0
          ? 'var(--card-bg)'
          : `linear-gradient(135deg, color-mix(in srgb, ${color} 18%, var(--card-bg)) 0%, var(--card-bg) 70%)`,
        border: currentStreak === 0
          ? '1px solid var(--border-color)'
          : `1px solid color-mix(in srgb, ${color} 35%, var(--border-color))`,
        boxShadow: isLegendary ? `0 0 32px color-mix(in srgb, ${color} 20%, transparent)` : 'var(--shadow)',
      }}
    >
      {/* Decorative background icon */}
      <div className="absolute right-5 top-4 text-7xl select-none pointer-events-none" style={{ opacity: 0.12 }}>
        {meta.icon}
      </div>

      {/* Streak number */}
      <div className="flex items-end gap-2 mb-3">
        <span className="text-6xl font-black leading-none" style={{ color }}>
          {currentStreak}
        </span>
        <span className="text-lg font-semibold pb-1" style={{ color: 'var(--text-secondary)' }}>
          day{currentStreak !== 1 ? 's' : ''} streak
        </span>
      </div>

      {/* Boost message */}
      <div className="space-y-1 pr-12">
        <p className="font-bold text-base flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <span>{meta.icon}</span>
          {meta.boost}
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {meta.tip}
        </p>
      </div>

      {/* Personal best */}
      {longestStreak > 0 && (
        <div
          className="mt-4 pt-3 flex items-center gap-1"
          style={{ borderTop: `1px solid color-mix(in srgb, ${color} 22%, var(--border-color))` }}
        >
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            🏅 Personal best:{' '}
            <strong style={{ color: currentStreak >= longestStreak ? color : 'var(--text-primary)' }}>
              {longestStreak} days
              {currentStreak >= longestStreak ? ' (current!)' : ''}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function HabitDetailPage() {
  const { habitId } = useParams();
  const navigate = useNavigate();
  const { definitions } = useOutletContext();
  const [activeTab, setActiveTab] = useState('overview');

  const definition = useMemo(
    () => definitions.find((d) => d._id === habitId),
    [definitions, habitId],
  );

  const { entries, rawEntries } = useHabitEntries(habitId, definition?.trackingType);

  const streak = useMemo(() => {
    if (definition?.trackingType === 'completion') {
      return calculateStreaks(entries);
    }
    if (definition?.trackingType === 'quantity' && definition?.goal?.value > 0) {
      return calculateStreaksFromGoal(entries, definition.goal.value);
    }
    return null;
  }, [entries, definition]);

  if (!definition) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-4">🤷</p>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Habit not found</p>
        <Button onClick={() => navigate('/')}>Back to Today</Button>
      </div>
    );
  }

  const hasData = Object.keys(entries).length > 0;

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5m7-7-7 7 7 7" />
          </svg>
        </Button>
        <div
          className="flex items-center gap-2 flex-1 rounded-xl px-3 py-2"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
        >
          <span className="text-2xl">{definition.icon}</span>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{definition.name}</h1>
          <Badge variant="outline" className="ml-auto">
            {TYPE_LABELS[definition.trackingType] || definition.trackingType}
          </Badge>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" onClick={() => navigate('/')}>📝 Add Entry</Button>
        <Button variant="outline" size="sm" onClick={() => downloadCSV(entries, `habit-${definition.name}`)}>
          📊 Export CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/manage')}>
          ✏️ Edit Habit
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
          <TabsTrigger value="analytics" className="flex-1">Analytics</TabsTrigger>
          <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
        </TabsList>

        {/* ── Overview tab ─────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {streak && <StreakBanner streak={streak} definition={definition} />}

          <StatsGrid entries={entries} trackingType={definition.trackingType} />

          {definition.goal?.enabled && (
            <GoalsTracker entries={entries} definition={definition} />
          )}

          <Card className="p-5">
            <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
              Last 5 Weeks
            </h3>
            <div className="max-w-[600px] mx-auto">
              <StreakCalendar habitData={entries} definition={definition} />
            </div>
          </Card>

        </TabsContent>

        {/* ── Analytics tab ────────────────────────────────────────── */}
        <TabsContent value="analytics" className="space-y-4 mt-4">
          {hasData && <SmartInsights entries={entries} definition={definition} />}
          <AnalyticsPanel entries={entries} definition={definition} />
        </TabsContent>

        {/* ── History tab ──────────────────────────────────────────── */}
        <TabsContent value="history" className="mt-4">
          <History habitData={entries} rawData={rawEntries} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

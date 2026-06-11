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
import { Skeleton } from '../components/ui/skeleton';
import { downloadCSV, calculateStreaks, calculateStreaksFromGoal } from '../utils/stats';
import { TYPE_LABELS } from '../constants/habits';

// ── Streak messages ────────────────────────────────────────────────────────────
const STREAK_CONFIG = [
  [365, (n) => ({ icon: '🎆', boost: `${n} days — a FULL YEAR of pure consistency!`, tip: "You've completed 365 consecutive days. You are unstoppable. This habit is now your identity." })],
  [300, (n) => ({ icon: '👑', boost: `${n} days — you've reached legend status!`, tip: "Only elite habit-builders reach 300 days. You're in the 0.1% club." })],
  [250, (n) => ({ icon: '💎', boost: `${n} days — unbreakable commitment!`, tip: "250 consecutive days proves you are unshakeable. Nothing can stop you now." })],
  [200, (n) => ({ icon: '🚀', boost: `${n} days — soaring into the stratosphere!`, tip: "Two hundred days of consistency. You've transcended ordinary habits." })],
  [180, (n) => ({ icon: '⭐', boost: `${n} days — half a year down!`, tip: "Six months of showing up, every single day. Your dedication is legendary." })],
  [150, (n) => ({ icon: '🔥', boost: `${n} days — absolute fire!`, tip: "Five months of unstoppable momentum. Your habit is forged in steel." })],
  [120, (n) => ({ icon: '✨', boost: `${n} days — four months of glory!`, tip: "Four solid months. You've proven this habit is permanent." })],
  [100, (n) => ({ icon: '🏆', boost: `${n} days — TRIPLE DIGITS!`, tip: "You've hit 100. Only 1% of habit-builders ever reach this. You're legendary." })],
  [90,  (n) => ({ icon: '💫', boost: `${n} days — three months of pure discipline!`, tip: "90 days in. Your brain has completely rewired around this habit." })],
  [80,  (n) => ({ icon: '⚡', boost: `${n} days — getting close to 100!`, tip: "You're in the final stretch. Ten more days until you hit triple digits." })],
  [70,  (n) => ({ icon: '🌟', boost: `${n} days — unstoppable momentum!`, tip: "Seven weeks down. You've proven you're not just motivated, you're committed." })],
  [60,  (n) => ({ icon: '🎯', boost: `${n} days — two months of consistency!`, tip: "60 days is where habits become unbreakable. You're officially unstoppable." })],
  [50,  (n) => ({ icon: '🔮', boost: `${n} days — halfway to 100!`, tip: "Fifty consecutive days. You're more than halfway to that triple-digit milestone." })],
  [45,  (n) => ({ icon: '💪', boost: `${n} days — almost at two months!`, tip: "You're just two weeks away from your two-month mark. Don't stop now." })],
  [40,  (n) => ({ icon: '🌈', boost: `${n} days — hitting your stride!`, tip: "Forty days in. The habit is becoming automatic, the urge to skip is fading." })],
  [35,  (n) => ({ icon: '🎪', boost: `${n} days — five solid weeks!`, tip: "Over a month done. You're proving this isn't just a phase." })],
  [30,  (n) => ({ icon: '🔥', boost: `${n} days — one full month formed!`, tip: "Neuroscience milestone: 30+ days rewires your brain. This habit is yours." })],
  [28,  (n) => ({ icon: '🌙', boost: `${n} days — almost a month!`, tip: "Four weeks down. Just two more days until you hit the 30-day brain-rewrite threshold." })],
  [25,  (n) => ({ icon: '🎁', boost: `${n} days — nearly there!`, tip: "25 days in. The final stretch to your one-month milestone." })],
  [21,  (n) => ({ icon: '⚡', boost: `${n} days — momentum is real!`, tip: "21 days is the threshold where habits start feeling natural. You've crossed it." })],
  [20,  (n) => ({ icon: '🎯', boost: `${n} days — one more week!`, tip: "20 days down. You're just one week away from the 21-day habit formation mark." })],
  [18,  (n) => ({ icon: '🌟', boost: `${n} days — almost three weeks!`, tip: "You're within arm's reach of the 21-day psychological threshold." })],
  [15,  (n) => ({ icon: '💎', boost: `${n} days — halfway to 30!`, tip: "Two and a half weeks in. You're halfway to your first major milestone." })],
  [14,  (n) => ({ icon: '💪', boost: `${n} days — two solid weeks!`, tip: "You've proven you can do this for two weeks straight. Keep the chain going." })],
  [12,  (n) => ({ icon: '✨', boost: `${n} days — almost there!`, tip: "Twelve days in. Just two more days until you hit the two-week mark." })],
  [10,  (n) => ({ icon: '🎉', boost: `${n} days — double digits!`, tip: "Ten consecutive days. You've crossed into true consistency territory." })],
  [9,   (n) => ({ icon: '🚀', boost: `${n} days — one more for double digits!`, tip: "Just one day away from hitting double digits. Do it today." })],
  [8,   (n) => ({ icon: '🔥', boost: `${n} days — over a week!`, tip: "More than a week of consistency. You're building real momentum." })],
  [7,   (n) => ({ icon: '🌟', boost: `${n} days — one full week!`, tip: "Seven days is a major psychological win. You've proven you're serious." })],
  [6,   (n) => ({ icon: '✨', boost: `${n} days — almost a week!`, tip: "Just one more day until you hit your first seven-day milestone." })],
  [5,   (n) => ({ icon: '🎯', boost: `${n} days — halfway to a week!`, tip: "Five days in and you're already seeing the habit take shape." })],
  [4,   (n) => ({ icon: '💫', boost: `${n} days — nearly a week!`, tip: "Four days down. Three more and you'll hit your first week." })],
  [3,   (n) => ({ icon: '⭐', boost: `${n} days — momentum building!`, tip: "Three consecutive days. Small wins compound into transformational results." })],
  [2,   (n) => ({ icon: '🌱', boost: `${n} days — you're rolling!`, tip: "Two days in and already building momentum. Don't break the chain tomorrow." })],
  [1,   (n) => ({ icon: '🎯', boost: `${n} day done — the journey begins!`, tip: "Every legendary streak started right here, at day one. You're on your way." })],
  [0,   () => ({ icon: '💡', boost: 'Ready to start your streak?', tip: "Log today and light the fire. Every great streak starts exactly here, at zero." })],
];

function getStreakMeta(n) {
  const config = STREAK_CONFIG.find(([threshold]) => n >= threshold);
  if (!config) return STREAK_CONFIG[STREAK_CONFIG.length - 1][1](n);
  const [, metaFn] = config;
  return typeof metaFn === 'function' ? metaFn(n) : metaFn;
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

// ── Loading skeleton ─────────────────────────────────────────────────────────
function DetailSkeleton() {
  return (
    <div className="space-y-4 mt-4">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
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

  const { entries, rawEntries, isLoading: entriesLoading } = useHabitEntries(habitId, definition?.trackingType);

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
      {entriesLoading ? (
        <DetailSkeleton />
      ) : (
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
      )}
    </div>
  );
}

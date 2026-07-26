import { useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboard } from '../api/habitDefinitionsApi';
import { fetchAiDigest } from '../api/insightsApi';
import { useAuth } from '../contexts/AuthContext';
import { getDateKey } from '../utils/dates';
import { getInsights, isGoalMet, fillMissingDays } from '../utils/stats';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';

// The dashboard endpoint nests entries as { [date]: { value } } — stats utils want { [date]: value }.
function flatten(obj) {
  const out = {};
  for (const [date, v] of Object.entries(obj || {})) {
    out[date] = v && typeof v === 'object' ? v.value : v;
  }
  return out;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good morning', icon: '🌅' };
  if (h < 17) return { text: 'Good afternoon', icon: '☀️' };
  if (h < 21) return { text: 'Good evening', icon: '🌆' };
  return { text: 'Good night', icon: '🌙' };
}

function ProgressRing({ ratio, doneToday, totalHabits }) {
  const size = 132, stroke = 12, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = Math.round(ratio * 100);
  const color = ratio >= 1 ? 'var(--success-color)' : 'var(--accent-color)';
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-color)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - ratio)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x="50%" y="45%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 30, fontWeight: 800, fill: 'var(--text-primary)' }}>{pct}%</text>
      <text x="50%" y="63%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 12, fill: 'var(--text-secondary)' }}>{doneToday} of {totalHabits} done</text>
    </svg>
  );
}

function StatChip({ icon, value, label }) {
  return (
    <div className="flex-1 rounded-xl p-3 text-center" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
      <div className="text-xl mb-0.5">{icon}</div>
      <div className="text-lg font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}

function HighlightCard({ title, accent, habit, line }) {
  if (!habit) return null;
  return (
    <div className="rounded-2xl p-4 flex-1 min-w-0" style={{
      background: `linear-gradient(135deg, color-mix(in srgb, ${habit.color} 12%, var(--card-bg)) 0%, var(--card-bg) 70%)`,
      border: `1px solid color-mix(in srgb, ${habit.color} 30%, var(--border-color))`,
    }}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: accent }}>{title}</p>
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: `color-mix(in srgb, ${habit.color} 18%, var(--bg-secondary))` }}>
          {habit.icon}
        </div>
        <div className="min-w-0">
          <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{habit.name}</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{line}</p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { definitions: allDefinitions, defsLoading } = useOutletContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const todayKey = getDateKey(new Date());
  // Archived habits keep their history but leave the daily views.
  const definitions = useMemo(() => allDefinitions.filter((d) => !d.archived), [allDefinitions]);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    staleTime: 1000 * 60,
  });
  const allEntries = data?.allEntries || {};
  // Both server-computed over FULL history — never capped by the 60-day entry
  // window that allEntries carries for rendering.
  const serverStreaks = data?.streaks || {};
  const serverSuccessRates = data?.successRates || {};

  const stats = useMemo(() => definitions.map((def) => {
    const entries = flatten(allEntries[def._id]);
    const direction = def.goal?.direction || 'at_least';
    const goalValue = def.goal?.value;
    const loggedDays = Object.keys(entries).length;
    const currentStreak = serverStreaks[def._id] ?? 0;
    // All-time, from the server. Computing it from `entries` here would only
    // ever see the last 60 days and contradict the Detail page.
    const successRate = serverSuccessRates[def._id] ?? 0;
    let loggedToday = false, insightEntries = entries;

    if (def.trackingType === 'completion') {
      const filled = fillMissingDays(entries);
      loggedToday = entries[todayKey] === 'yes';
      insightEntries = filled;
    } else {
      loggedToday = typeof entries[todayKey] === 'number' && isGoalMet(entries[todayKey], goalValue, direction);
    }
    return { def, entries, insightEntries, currentStreak, successRate, loggedToday, loggedDays };
  }), [definitions, allEntries, serverStreaks, serverSuccessRates, todayKey]);

  const totalHabits = stats.length;
  const doneToday = stats.filter((s) => s.loggedToday).length;
  const todayRatio = totalHabits ? doneToday / totalHabits : 0;
  const activeStreaks = stats.filter((s) => s.currentStreak > 0).length;
  // The habit with the highest CURRENT streak — not an all-time record. The
  // chip is labelled accordingly so the number can't be misread.
  const bestActive = stats.reduce((a, s) => (s.currentStreak > (a?.currentStreak || 0) ? s : a), null);
  const withData = stats.filter((s) => s.loggedDays >= 3);
  const topPerformer = withData.slice().sort((a, b) => b.currentStreak - a.currentStreak || b.successRate - a.successRate)[0];
  const needsAttention = withData.slice().sort((a, b) => a.successRate - b.successRate || a.currentStreak - b.currentStreak)[0];

  const digest = useMemo(() => {
    const out = [];
    for (const s of stats) {
      if (s.loggedDays < 3) continue;
      const ins = getInsights(s.insightEntries, s.def);
      if (ins[0]) out.push({ habit: s.def, text: ins[0] });
      if (out.length >= 4) break;
    }
    return out;
  }, [stats]);

  // AI-written daily digest — replaces the rule-based list when available;
  // on null (unconfigured / quota / error) the rule-based digest stays.
  const { data: aiDigest } = useQuery({
    queryKey: ['ai-digest'],
    queryFn: fetchAiDigest,
    staleTime: 1000 * 60 * 60,
    enabled: definitions.length > 0,
  });

  const g = greeting();
  const name = user?.name || user?.username || 'there';

  if (defsLoading || (isLoading && !data)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid sm:grid-cols-2 gap-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (totalHabits === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-5xl mb-4">📊</p>
        <h2 className="text-xl font-bold text-foreground mb-2">Your dashboard awaits</h2>
        <p className="text-muted-foreground mb-6">Add a habit and start logging to see your stats here.</p>
        <Button onClick={() => navigate('/manage?tab=add')} size="lg">Create Habit</Button>
      </div>
    );
  }

  const summary = doneToday === totalHabits
    ? "Every habit done today — incredible! 🎉"
    : doneToday === 0
      ? "Nothing logged yet — pick one and start your day."
      : `You've completed ${doneToday} of ${totalHabits} habits today.`;

  return (
    <div className="space-y-5">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{g.text}, {name} {g.icon}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{summary}</p>
      </div>

      {/* At-a-glance today */}
      <div className="ht-card p-5 flex flex-col sm:flex-row items-center gap-5">
        <ProgressRing ratio={todayRatio} doneToday={doneToday} totalHabits={totalHabits} />
        <div className="flex gap-2 w-full">
          <StatChip icon="✅" value={`${doneToday}/${totalHabits}`} label="Done today" />
          <StatChip icon="🔥" value={activeStreaks} label="Active streaks" />
          <StatChip
            icon="🏅"
            value={bestActive?.currentStreak || 0}
            label={bestActive?.currentStreak ? `Best: ${bestActive.def.name}` : 'Best streak now'}
          />
        </div>
      </div>

      {/* Motivation */}
      {(topPerformer || needsAttention) && (
        <div className="flex flex-col sm:flex-row gap-3">
          <HighlightCard
            title="🏆 Top performer" accent="var(--success-color)" habit={topPerformer?.def}
            line={topPerformer ? `${topPerformer.currentStreak}-day streak · ${topPerformer.successRate}% success` : ''}
          />
          {needsAttention && topPerformer && needsAttention.def._id !== topPerformer.def._id && (
            <HighlightCard
              title="🌱 Needs attention" accent="var(--accent-color)" habit={needsAttention.def}
              line={`${needsAttention.successRate}% success rate — pick it back up today`}
            />
          )}
        </div>
      )}

      {/* Insights digest — AI-written when available, rule-based otherwise */}
      {(aiDigest?.text || digest.length > 0) && (
        <div className="ht-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">{aiDigest?.text ? '🤖' : '💡'}</span>
            <h3 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
              {aiDigest?.text ? "Today's digest" : 'Insights'}
            </h3>
          </div>
          {aiDigest?.text ? (
            <p
              className="text-sm leading-relaxed p-3 rounded-xl"
              style={{
                color: 'var(--text-primary)',
                background: 'color-mix(in srgb, var(--accent-color) 6%, var(--bg-secondary))',
                border: '1px solid color-mix(in srgb, var(--accent-color) 22%, var(--border-color))',
              }}
            >
              {aiDigest.text}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {digest.map((d, i) => (
                <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <span className="text-lg shrink-0">{d.habit.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold" style={{ color: d.habit.color }}>{d.habit.name}</p>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{d.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Per-habit overview */}
      <div className="ht-card p-5">
        <h3 className="font-semibold text-base mb-3" style={{ color: 'var(--text-primary)' }}>All habits</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {stats.map((s) => (
            <button
              key={s.def._id}
              onClick={() => { sessionStorage.setItem('ht_active_habit', s.def._id); navigate('/detail'); }}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors hover:border-primary"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
            >
              <span className="text-lg shrink-0">{s.def.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{s.def.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {s.loggedToday ? '✓ done today' : '— pending'} · 🔥 {s.currentStreak}d
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

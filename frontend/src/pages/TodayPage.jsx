import { useCallback, useState, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchDashboard } from '../api/habitDefinitionsApi';
import { saveEntry } from '../api/entriesApi';

import { getDateKey } from '../utils/dates';
import { calculateStreaks, calculateStreaksFromGoal, fillMissingDays } from '../utils/stats';
import { CELEBRATION_MILESTONES } from '../constants/milestones';
import { celebrateMilestone } from '../lib/celebrate';
import DynamicLogEntry from '../components/DynamicLogEntry/DynamicLogEntry';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { notify } from '../lib/toast';
import cardStyles from '../components/DynamicLogEntry/DynamicLogEntry.module.scss';

function TodaySkeleton({ count = 3 }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-9 w-24" />
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
        >
          <Skeleton className="h-1 w-full rounded-none" />
          <div className="p-4">
            <div className="flex items-center gap-2.5 mb-4">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Each card owns its animation state — prevents animation from leaking across cards
// when parent re-renders during optimistic updates.
function HabitCard({ def, entry, allEntries, isSaving, onLog, onNavigate }) {
  const [animationType, setAnimationType] = useState(null);
  const timerRef = useRef(null);
  const isLogged = entry?.value !== undefined && entry?.value !== null;

  const handleAnimationTrigger = useCallback((type) => {
    clearTimeout(timerRef.current);
    setAnimationType(type);
    timerRef.current = setTimeout(() => setAnimationType(null), 350);
  }, []);

  return (
    <div
      className={`rounded-xl overflow-hidden ${
        animationType === 'success' ? cardStyles.successAnimation :
        animationType === 'failure' ? cardStyles.failureAnimation : ''
      }`}
      style={{
        background: isLogged
          ? `color-mix(in srgb, ${def.color} 6%, var(--card-bg))`
          : 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow)',
        transition: 'background 0.2s',
      }}
    >
      <div className="h-1 w-full" style={{ background: def.color }} />
      <div className="p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-xl shrink-0"
            style={{ background: `color-mix(in srgb, ${def.color} 15%, var(--bg-secondary))` }}
          >
            {def.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
              {def.name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {def.trackingType === 'quantity' && def.unit ? def.unit : def.trackingType === 'completion' ? 'Done / Not Done' : ''}
            </p>
          </div>
          {isLogged ? (
            <Badge className="shrink-0 pointer-events-none text-xs text-white" style={{ background: def.color }}>
              ✓ Logged
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 pointer-events-none text-xs">
              Pending
            </Badge>
          )}
        </div>

        <div onClick={(e) => e.stopPropagation()} className="cursor-default">
          <DynamicLogEntry
            definition={def}
            existingEntry={entry || {}}
            habitEntries={allEntries}
            onLog={onLog}
            isSaving={isSaving}
            onAnimationTrigger={handleAnimationTrigger}
          />
        </div>

        <div className="mt-3 flex justify-end">
          <button
            onClick={onNavigate}
            className="text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: def.color }}
          >
            View details →
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TodayPage() {
  const { definitions, defsLoading } = useOutletContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    staleTime: 1000 * 60,
  });

  const todayEntries = dashboardData?.todayEntries || {};
  const allEntries = dashboardData?.allEntries || {};

  const logMutation = useMutation({
    mutationFn: ({ habitId, date, value }) => saveEntry(habitId, { date, value }),
    // Optimistic update: reflect the log instantly in the dashboard cache instead of
    // waiting for the POST + a full dashboard refetch (heavy on mobile).
    onMutate: async ({ habitId, date, value }) => {
      await queryClient.cancelQueries({ queryKey: ['dashboard'] });
      const previous = queryClient.getQueryData(['dashboard']);
      const todayKey = getDateKey(new Date());
      queryClient.setQueryData(['dashboard'], (old) => {
        if (!old) return old;
        const next = {
          ...old,
          todayEntries: { ...old.todayEntries },
          allEntries: { ...old.allEntries, [habitId]: { ...(old.allEntries?.[habitId] || {}) } },
        };
        if (date === todayKey) next.todayEntries[habitId] = { value };
        next.allEntries[habitId][date] = { value };
        return next;
      });
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['dashboard'], ctx.previous);
      notify.error("Couldn't save", err.message || 'Check your connection and try again.');
    },
    // Celebrate when a *today* log pushes a habit onto a streak milestone.
    onSuccess: (_data, { habitId, date }) => {
      const todayKey = getDateKey(new Date());
      if (date !== todayKey) return; // ignore backdated edits
      const def = definitions.find((d) => d._id === habitId);
      if (!def) return;
      const raw = queryClient.getQueryData(['dashboard'])?.allEntries?.[habitId] || {};
      const entries = {};
      for (const [d, v] of Object.entries(raw)) entries[d] = v && typeof v === 'object' ? v.value : v;
      let streak = 0;
      if (def.trackingType === 'completion') {
        streak = calculateStreaks(fillMissingDays(entries)).currentStreak;
      } else if (def.goal?.value) {
        streak = calculateStreaksFromGoal(entries, def.goal.value, def.goal.direction).currentStreak;
      }
      const milestone = CELEBRATION_MILESTONES.find((m) => m === streak);
      if (milestone) celebrateMilestone({ habitId, habitName: def.name, milestone });
    },
    // Mark the detail-page cache stale (it isn't mounted, so this won't trigger a refetch now).
    onSettled: (_d, _e, { habitId }) => {
      queryClient.invalidateQueries({ queryKey: ['habit-entries', habitId] });
    },
  });

  const handleLog = useCallback(({ date, value }, habitId) => {
    logMutation.mutate({ habitId, date, value });
  }, [logMutation]);

  const todayDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  // Show skeletons until both the habit list and today's entries are ready.
  if (defsLoading || (dashboardLoading && !dashboardData)) {
    return <TodaySkeleton count={definitions.length || 3} />;
  }

  // Empty state
  if (definitions.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-5xl mb-4">🎯</p>
        <h2 className="text-xl font-bold text-foreground mb-2">Start tracking</h2>
        <p className="text-muted-foreground mb-6">Create your first habit to begin</p>
        <Button onClick={() => navigate('/manage?tab=add')} size="lg">
          Create Habit
        </Button>
      </div>
    );
  }

  // Habits List
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">{todayDate}</h1>
        <Button variant="outline" size="sm" onClick={() => navigate('/manage?tab=add')}>
          New Habit
        </Button>
      </div>

      {definitions.map((def) => (
        <HabitCard
          key={def._id}
          def={def}
          entry={todayEntries[def._id]}
          allEntries={allEntries[def._id] || {}}
          isSaving={logMutation.isPending}
          onLog={({ date, value }) => handleLog({ date, value }, def._id)}
          onNavigate={() => {
            sessionStorage.setItem('ht_active_habit', def._id);
            navigate('/detail');
          }}
        />
      ))}
    </div>
  );
}

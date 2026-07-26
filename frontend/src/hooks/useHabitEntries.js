import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchEntries, saveEntry } from '../api/entriesApi';
import { fillMissingDays } from '../utils/stats/shared';
import { isGoalMet } from '../utils/stats/numeric';
import { getDateKey } from '../utils/dates';
import { notify } from '../lib/toast';

// Feedback is shown optimistically (before the network round trip) and honors
// the goal direction — logging under an at_most limit is a win, not a miss.
function toastForLog(definition, value) {
  if (definition?.trackingType === 'completion') {
    return value === 'yes'
      ? () => notify.success('Logged!', 'Nice — keep the streak going. 🔥')
      : () => notify.info('Marked as not done', "No worries — tomorrow's a fresh start.");
  }
  const goal = definition?.goal;
  const num = Number(value);
  const success = goal?.value ? isGoalMet(num, goal.value, goal.direction) : num > 0;
  if (success) return () => notify.success('Logged!', 'Goal met — keep the streak going. 🔥');
  return goal?.direction === 'at_most'
    ? () => notify.info('Logged', "Over today's limit — tomorrow's a fresh start.")
    : () => notify.info('Logged', "Below today's target — every bit counts.");
}

export function useHabitEntries(habitId, definition) {
  const queryClient = useQueryClient();
  const queryKey = ['habit-entries', habitId];
  const trackingType = definition?.trackingType;

  const {
    data: rawEntries = {},
    isLoading,
    isError,
  } = useQuery({
    queryKey,
    queryFn: () => fetchEntries(habitId),
    staleTime: 1000 * 60 * 5,
    enabled: !!habitId,
  });

  const filledEntries = useMemo(() => {
    if (trackingType === 'completion') {
      return fillMissingDays(rawEntries);
    }
    return rawEntries;
  }, [rawEntries, trackingType]);

  const { mutate: logEntry, isPending: isSaving } = useMutation({
    mutationFn: ({ date, value }) => saveEntry(habitId, { date, value }),
    onMutate: async ({ date, value }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old = {}) => ({
        ...old,
        [date]: value,
      }));

      // Mirror the log into the dashboard cache so Track/Dashboard reflect it
      // instantly without a refetch (its entries are wrapped as { value }).
      const previousDashboard = queryClient.getQueryData(['dashboard']);
      if (previousDashboard) {
        const todayKey = getDateKey(new Date());
        queryClient.setQueryData(['dashboard'], (old) => {
          if (!old) return old;
          const next = {
            ...old,
            todayEntries: { ...old.todayEntries },
            allEntries: { ...old.allEntries, [habitId]: { ...(old.allEntries?.[habitId] || {}), [date]: { value } } },
          };
          if (date === todayKey) next.todayEntries[habitId] = { value };
          return next;
        });
      }

      toastForLog(definition, value)();
      return { previous, previousDashboard };
    },
    onError: (err, _vars, context) => {
      queryClient.setQueryData(queryKey, context.previous);
      if (context.previousDashboard) queryClient.setQueryData(['dashboard'], context.previousDashboard);
      notify.error("Couldn't save", err.message || "That log didn't stick — check your connection and try again.");
    },
    onSuccess: (data) => {
      // The entry response carries the authoritative streak — sync the dashboard cache.
      if (typeof data?.currentStreak === 'number') {
        queryClient.setQueryData(['dashboard'], (old) =>
          old ? { ...old, streaks: { ...old.streaks, [habitId]: data.currentStreak } } : old);
      }
    },
    onSettled: () => {
      // The optimistic value IS the server value — mark stale for the next mount
      // instead of refetching immediately (kills the post-log network waterfall).
      queryClient.invalidateQueries({ queryKey, refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'none' });
      // AI text describes today's progress, so logging invalidates it too — the
      // server regenerates on the next fetch because its stats fingerprint moved.
      // Still refetchType 'none': these cards aren't on screen while logging, so
      // they refresh on the next visit instead of spending a generation now.
      queryClient.invalidateQueries({ queryKey: ['ai-digest'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['ai-insight', habitId], refetchType: 'none' });
    },
  });

  return { entries: filledEntries, rawEntries, isLoading, isError, logEntry, isSaving };
}

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchEntries, saveEntry } from '../api/entriesApi';
import { fillMissingDays } from '../utils/stats/shared';

export function useHabitEntries(habitId, trackingType) {
  const queryClient = useQueryClient();
  const queryKey = ['habit-entries', habitId];

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
      return { previous };
    },
    onError: (err, _vars, context) => {
      queryClient.setQueryData(queryKey, context.previous);
      toast.error(err.message || 'Failed to save. Check your connection.');
    },
    onSuccess: (_, { value }) => {
      const isPositive = value === 'yes' || (trackingType === 'quantity' && Number(value) > 0);
      toast.success(isPositive ? '✅ Logged!' : '❌ Missed');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return { entries: filledEntries, rawEntries, isLoading, isError, logEntry, isSaving };
}

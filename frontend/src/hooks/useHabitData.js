import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchHabits, saveHabit } from '../api/habitsApi';
import { fillMissingDays } from '../utils/stats';

export function useHabitData() {
  const queryClient = useQueryClient();

  const {
    data: rawData = {},
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['habits'],
    queryFn: fetchHabits,
    staleTime: 1000 * 60 * 5,
  });

  // Fill date gaps in-memory as 'no' for past days only.
  // Today is intentionally skipped so the streak isn't reset at midnight.
  const habitData = useMemo(() => fillMissingDays(rawData), [rawData]);

  const { mutate: logHabit, isPending: isSaving } = useMutation({
    mutationFn: saveHabit,
    onMutate: async ({ date, response }) => {
      await queryClient.cancelQueries({ queryKey: ['habits'] });
      const previous = queryClient.getQueryData(['habits']);
      // Optimistic update — UI reflects the change immediately
      queryClient.setQueryData(['habits'], (old = {}) => ({
        ...old,
        [date]: response,
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['habits'], context.previous);
      toast.error('Failed to save. Check your connection.');
    },
    onSuccess: (_, { response }) => {
      toast.success(response === 'yes' ? '✅ Logged for today!' : '❌ Marked as missed');
    },
    onSettled: () => {
      // Re-fetch to ensure server and client are in sync
      queryClient.invalidateQueries({ queryKey: ['habits'] });
    },
  });

  return { habitData, rawData: rawData ?? {}, isLoading, isError, logHabit, isSaving };
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '../lib/toast';
import {
  fetchDefinitions,
  createDefinition,
  updateDefinition,
  deleteDefinition,
  bulkCreateDefinitions,
  reorderDefinitions,
} from '../api/habitDefinitionsApi';

export function useHabitDefinitions() {
  const queryClient = useQueryClient();

  const {
    data: definitions = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['habit-definitions'],
    queryFn: fetchDefinitions,
    staleTime: 1000 * 60 * 5,
  });

  const createMutation = useMutation({
    mutationFn: createDefinition,
    onSuccess: (data) => {
      queryClient.setQueryData(['habit-definitions'], (old = []) => [...old, data]);
      notify.success('Habit created', `"${data.name}" is ready — start logging today.`);
    },
    onError: (err) => notify.error("Couldn't create habit", err.message || 'Please try again.'),
  });

  const bulkCreateMutation = useMutation({
    mutationFn: bulkCreateDefinitions,
    onSuccess: (data) => {
      queryClient.setQueryData(['habit-definitions'], (old = []) => [...old, ...data.habits]);
      notify.success('Habits added', `${data.count} ${data.count === 1 ? 'habit' : 'habits'} created — you're all set.`);
    },
    onError: (err) => notify.error("Couldn't create habits", err.message || 'Please try again.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateDefinition(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['habit-definitions'], (old = []) =>
        old.map((d) => (d._id === updated._id ? updated : d))
      );
      notify.success('Changes saved', `"${updated.name}" has been updated.`);
    },
    onError: (err) => notify.error("Couldn't save changes", err.message || 'Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDefinition,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['habit-definitions'] });
      const previous = queryClient.getQueryData(['habit-definitions']);
      const habit = previous?.find((d) => d._id === id);
      queryClient.setQueryData(['habit-definitions'], (old = []) =>
        old.filter((d) => d._id !== id)
      );
      return { previous, habitName: habit?.name ?? 'Habit' };
    },
    onError: (err, _id, context) => {
      queryClient.setQueryData(['habit-definitions'], context.previous);
      notify.error("Couldn't delete habit", err.message || 'Please try again.');
    },
    onSuccess: (data, _id, context) => {
      queryClient.invalidateQueries({ queryKey: ['habit-definitions'] });
      const name = context?.habitName ?? 'Habit';
      const count = data?.deletedEntries ?? 0;
      const detail = count > 0
        ? `${count} ${count === 1 ? 'entry' : 'entries'} cleared too.`
        : 'It’s been removed.';
      notify.success(`"${name}" deleted`, detail);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: reorderDefinitions,
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: ['habit-definitions'] });
      const previous = queryClient.getQueryData(['habit-definitions']);
      const old = previous || [];
      const reordered = orderedIds.map((id) => old.find((d) => d._id === id)).filter(Boolean);
      queryClient.setQueryData(['habit-definitions'], reordered);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['habit-definitions'], context.previous);
      notify.error("Couldn't reorder", 'Your habit order was restored.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['habit-definitions'] });
    },
  });

  return {
    definitions,
    isLoading,
    isError,
    createHabit: createMutation.mutate,
    isCreating: createMutation.isPending,
    bulkCreateHabits: bulkCreateMutation.mutate,
    bulkCreateHabitsAsync: bulkCreateMutation.mutateAsync,
    isBulkCreating: bulkCreateMutation.isPending,
    updateHabit: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    deleteHabit: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    reorderHabits: reorderMutation.mutate,
    isReordering: reorderMutation.isPending,
  };
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  fetchDefinitions,
  createDefinition,
  updateDefinition,
  deleteDefinition,
  bulkCreateDefinitions,
  reorderDefinitions,
  applyTypeChange,
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
      toast.success(`"${data.name}" added! Start logging.`);
    },
    onError: (err) => toast.error(err.message || 'Failed to create habit'),
  });

  const bulkCreateMutation = useMutation({
    mutationFn: bulkCreateDefinitions,
    onSuccess: (data) => {
      queryClient.setQueryData(['habit-definitions'], (old = []) => [...old, ...data.habits]);
      toast.success(`${data.count} habits created!`);
    },
    onError: (err) => toast.error(err.message || 'Failed to create habits'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateDefinition(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['habit-definitions'], (old = []) =>
        old.map((d) => (d._id === updated._id ? updated : d))
      );
      toast.success(`"${updated.name}" saved`);
    },
    onError: (err) => toast.error(err.message || 'Failed to update habit'),
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
      toast.error(err.message || 'Failed to delete habit');
    },
    onSuccess: (data, _id, context) => {
      queryClient.invalidateQueries({ queryKey: ['habit-definitions'] });
      const name = context?.habitName ?? 'Habit';
      const count = data?.deletedEntries ?? 0;
      const msg = count > 0
        ? `"${name}" deleted — ${count} ${count === 1 ? 'entry' : 'entries'} cleared`
        : `"${name}" deleted`;
      toast.success(msg);
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
      toast.error('Failed to reorder');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['habit-definitions'] });
    },
  });

  const typeChangeMutation = useMutation({
    mutationFn: ({ id, data }) => applyTypeChange(id, data),
    onSuccess: (result) => {
      queryClient.setQueryData(['habit-definitions'], (old = []) =>
        old.map((d) => (d._id === result.definition._id ? result.definition : d))
      );
      queryClient.invalidateQueries({ queryKey: ['habit-entries', result.definition._id] });
      const n = result.changed;
      toast.success(`Type changed — ${n} ${n === 1 ? 'entry' : 'entries'} converted`);
    },
    onError: (err) => toast.error(err.message || 'Failed to change type'),
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
    changeType: typeChangeMutation.mutate,
    isTypeChanging: typeChangeMutation.isPending,
  };
}

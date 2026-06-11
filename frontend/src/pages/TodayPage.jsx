import { useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchDashboard } from '../api/habitDefinitionsApi';
import { saveEntry } from '../api/entriesApi';
import DynamicLogEntry from '../components/DynamicLogEntry/DynamicLogEntry';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import toast from 'react-hot-toast';

export default function TodayPage() {
  const { definitions, defsLoading } = useOutletContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    staleTime: 1000 * 60,
  });

  const todayEntries = dashboardData?.todayEntries || {};
  const allEntries = dashboardData?.allEntries || {};

  const logMutation = useMutation({
    mutationFn: ({ habitId, date, value }) => saveEntry(habitId, { date, value }),
    onSuccess: (_, { habitId }) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['habit-entries', habitId] });
      toast.success('Logged!');
    },
    onError: (err) => toast.error(err.message || 'Failed to save'),
  });

  const handleLog = useCallback(({ date, value }, habitId) => {
    logMutation.mutate({ habitId, date, value });
  }, [logMutation]);

  const todayDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  if (defsLoading) return null;

  // Empty state
  if (definitions.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-5xl mb-4">🎯</p>
        <h2 className="text-xl font-bold text-foreground mb-2">Start tracking</h2>
        <p className="text-muted-foreground mb-6">Create your first habit to begin</p>
        <Button onClick={() => navigate('/manage')} size="lg">
          + Create Habit
        </Button>
      </div>
    );
  }

  // Habits List
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">{todayDate}</h1>
        <Button variant="outline" size="sm" onClick={() => navigate('/manage')}>
          + New Habit
        </Button>
      </div>

      {definitions.map((def) => {
        const entry = todayEntries[def._id];
        const isLogged = entry?.value !== undefined && entry?.value !== null;

        return (
          <div
            key={def._id}
            className="rounded-xl overflow-hidden transition-all"
            style={{
              background: isLogged
                ? `color-mix(in srgb, ${def.color} 6%, var(--card-bg))`
                : 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow)',
            }}
          >
            {/* Colored top accent bar */}
            <div className="h-1 w-full" style={{ background: def.color }} />

            <div className="p-4">
              {/* Header row */}
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
                  <Badge
                    className="shrink-0 pointer-events-none text-xs text-white"
                    style={{ background: def.color }}
                  >
                    ✓ Logged
                  </Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0 pointer-events-none text-xs">
                    Pending
                  </Badge>
                )}
              </div>

              {/* Log entry */}
              <div onClick={(e) => e.stopPropagation()} className="cursor-default">
                <DynamicLogEntry
                  definition={def}
                  existingEntry={entry || {}}
                  habitEntries={allEntries[def._id] || {}}
                  onLog={({ date, value }) => handleLog({ date, value }, def._id)}
                  isSaving={logMutation.isPending}
                />
              </div>

              {/* View details */}
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => navigate(`/habit/${def._id}`)}
                  className="text-xs font-medium transition-colors hover:opacity-80"
                  style={{ color: def.color }}
                >
                  View details →
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

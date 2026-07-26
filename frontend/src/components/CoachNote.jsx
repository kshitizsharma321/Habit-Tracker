import { useQuery } from '@tanstack/react-query';
import { fetchAiInsight } from '../api/insightsApi';
import { Skeleton } from './ui/skeleton';

// AI-written daily note for one habit. Renders nothing when the backend has no
// AI configured or returns no text — the rule-based insights below always remain.
export default function CoachNote({ habitId, enabled = true }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ai-insight', habitId],
    queryFn: () => fetchAiInsight(habitId),
    // Notes regenerate once per day server-side — no point refetching sooner.
    staleTime: 1000 * 60 * 60,
    enabled: enabled && !!habitId,
  });

  if (isLoading) {
    return (
      <div className="ht-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🤖</span>
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!data?.text) return null;

  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: 'color-mix(in srgb, var(--accent-color) 6%, var(--card-bg))',
        border: '1px solid color-mix(in srgb, var(--accent-color) 25%, var(--border-color))',
        boxShadow: 'var(--shadow)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">🤖</span>
        <h5 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
          Coach&apos;s note
        </h5>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
        {data.text}
      </p>
    </div>
  );
}

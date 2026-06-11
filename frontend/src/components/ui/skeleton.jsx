import { cn } from '../../lib/utils';

/**
 * Animated placeholder block shown while data loads.
 * Uses the muted token so it adapts to light/dark themes.
 */
function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };

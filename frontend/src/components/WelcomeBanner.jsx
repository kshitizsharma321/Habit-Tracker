import { useState } from 'react';

export default function WelcomeBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="mb-6 rounded-card border border-[rgba(99,102,241,0.35)] bg-[rgba(99,102,241,0.07)] p-4 flex items-start justify-between gap-4">
      <div>
        <p className="font-semibold text-text-primary">👋 Welcome to Habit Tracker!</p>
        <p className="text-sm text-text-secondary mt-1">
          Click <strong>Yes</strong> or <strong>No</strong> each day to record your habit.
          Use <kbd>Y</kbd> / <kbd>N</kbd> as keyboard shortcuts.
          Click the habit name in the header to rename it.
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 text-xl leading-none text-text-secondary hover:text-text-primary transition-colors"
      >
        ×
      </button>
    </div>
  );
}

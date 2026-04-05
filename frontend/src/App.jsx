import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { useTheme } from './contexts/ThemeContext';
import { useHabitData } from './hooks/useHabitData';
import { useHabitName } from './hooks/useHabitName';
import HabitNameEditor from './components/HabitNameEditor';
import StreakBanner from './components/StreakBanner';
import StreakCalendar from './components/StreakCalendar/StreakCalendar';
import ProgressBars from './components/ProgressBars';
import StatsGrid from './components/StatsGrid';
import LogEntry from './components/LogEntry/LogEntry';
import History from './components/History/History';
import AdvancedStatsModal from './components/AdvancedStatsModal';
import WelcomeBanner from './components/WelcomeBanner';
import NotificationSettings from './components/NotificationSettings/NotificationSettings';
import { downloadCSV } from './utils/stats';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 1000 * 60 * 5 },
  },
});

function HabitApp() {
  const { habitData, rawData, isLoading, isError, logHabit, isSaving } = useHabitData();
  const [habitName, updateHabitName] = useHabitName();
  const { theme, toggleTheme } = useTheme();
  const [showStats, setShowStats] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">⏳</div>
          <p className="text-text-secondary">Loading your habits…</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary">
        <div className="text-center p-8 rounded-card bg-card-bg border border-border-col shadow-card max-w-sm">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="font-semibold text-text-primary">Failed to connect to server</p>
          <p className="text-sm text-text-secondary mt-2">
            Make sure the backend is running on port 3000.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded-lg bg-ht-accent text-white font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isFirstTimeUser = Object.keys(rawData).length === 0;

  return (
    <>
      {/* ── Sticky site header ────────────────────────────────────────── */}
      <header className="ht-header">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <HabitNameEditor name={habitName} onSave={updateHabitName} />
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="shrink-0 bg-bg-secondary border border-border-col rounded-lg px-3 py-1.5 text-lg hover:shadow-card-hover transition-shadow"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {isFirstTimeUser && <WelcomeBanner />}

        {/* Streak hero */}
        <StreakBanner habitData={habitData} habitName={habitName} />

        {/* ── Two-column grid on large screens ──────────────────────── */}
        <div className="grid lg:grid-cols-5 gap-5 mb-5">

          {/* Left: Log entry + Progress Overview */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            <LogEntry
              habitData={habitData}
              habitName={habitName}
              onLog={logHabit}
              isSaving={isSaving}
            />
            <ProgressBars habitData={habitData} />
          </div>

          {/* Right: Calendar only */}
          <div className="lg:col-span-3">
            <div className="ht-card p-5 h-full">
              <h5 className="font-semibold text-base mb-3 text-text-primary">
                Last 5 Weeks
              </h5>
              <StreakCalendar habitData={habitData} />
            </div>
          </div>
        </div>

        {/* ── Stats grid (4 cards, full width) ───────────────────────── */}
        <StatsGrid habitData={habitData} />

        {/* ── Action buttons ─────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => downloadCSV(rawData)}
            className="px-4 py-2 rounded-lg border-2 border-ht-accent text-ht-accent font-semibold text-sm hover:bg-ht-accent hover:text-white transition-colors"
          >
            📊 Download CSV
          </button>
          <button
            onClick={() => setShowStats(true)}
            className="px-4 py-2 rounded-lg border-2 border-[#06b6d4] text-[#06b6d4] font-semibold text-sm hover:bg-[#06b6d4] hover:text-white transition-colors"
          >
            📈 Advanced Stats
          </button>
        </div>

        {/* ── Notification settings ────────────────────────────────────── */}
        <NotificationSettings />

        {/* ── History ──────────────────────────────────────────────────── */}
        <History habitData={habitData} rawData={rawData} />

        <AdvancedStatsModal
          isOpen={showStats}
          habitData={habitData}
          onClose={() => setShowStats(false)}
        />
      </main>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--card-bg)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
          },
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <HabitApp />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

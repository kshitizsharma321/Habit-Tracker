import { useRef, useEffect, useState } from 'react';
import { calculateStreaks } from '../utils/stats';

const STREAK_EMOJIS = [
  [365, '🪐'],
  [200, '🌟'],
  [150, '⚡'],
  [100, '💯'],
  [90,  '🏅'],
  [75,  '🦅'],
  [60,  '🦄'],
  [45,  '🎯'],
  [30,  '💎'],
  [21,  '🏆'],
  [14,  '🚀'],
  [10,  '✨'],
  [7,   '🔥'],
  [5,   '💪'],
  [3,   '👏'],
  [2,   '✌️'],
  [1,   '🌱'],
  [0,   '💤'],
];

const MESSAGES = [
  [365, 'A full year. You are legendary.'],
  [200, '200 days strong. Truly elite.'],
  [150, 'Halfway to a year — incredible dedication.'],
  [100, 'Triple digits. You are absolutely unstoppable.'],
  [90,  'Three months straight. Outstanding discipline.'],
  [75,  '75 days — a whole new you is emerging.'],
  [60,  'Two months of showing up every single day!'],
  [45,  '45 days — this is a real habit now.'],
  [30,  'One full month. You are genuinely on fire!'],
  [21,  '21 days — habit officially formed. Science agrees.'],
  [14,  'Two weeks strong — amazing consistency!'],
  [10,  '10 days in — this is starting to feel natural.'],
  [7,   'One week done — keep that fire burning!'],
  [5,   '5 days straight — you are in the groove!'],
  [3,   '3 days in — momentum is building!'],
  [2,   'Back-to-back! Build on this.'],
  [1,   'Day one down — momentum starts now!'],
  [0,   'No streak yet — log today and kick things off!'],
];

// Milestones that trigger the pulse animation
const MILESTONE_DAYS = new Set([1, 3, 5, 7, 10, 14, 21, 30, 45, 60, 75, 90, 100, 150, 200, 365]);

function getEmoji(streak) {
  return (STREAK_EMOJIS.find(([t]) => streak >= t) ?? STREAK_EMOJIS.at(-1))[1];
}

function getMessage(streak) {
  return (MESSAGES.find(([t]) => streak >= t) ?? MESSAGES.at(-1))[1];
}

export default function StreakBanner({ habitData, habitName }) {
  const { currentStreak } = calculateStreaks(habitData);
  const streakRef = useRef(null);
  const [milestoneClass, setMilestoneClass] = useState('');

  // Pulse animation on key milestones
  useEffect(() => {
    if (currentStreak > 0 && MILESTONE_DAYS.has(currentStreak)) {
      setMilestoneClass('streak-milestone');
      const id = setTimeout(() => setMilestoneClass(''), 3000);
      return () => clearTimeout(id);
    }
  }, [currentStreak]);

  return (
    <div className="text-center mb-6">
      {/* {habitName && (
        <p className="text-sm font-medium text-text-secondary mb-1 uppercase tracking-widest">
          {habitName}
        </p>
      )} */}
      <h1 className="text-3xl font-bold text-text-primary">
        Current Streak:{' '}
        <span
          ref={streakRef}
          className={`inline-block bg-ht-success text-white rounded-lg px-3 py-1 text-2xl ${milestoneClass}`}
        >
          {currentStreak}
        </span>{' '}
        <span role="img" aria-label="streak icon">
          {getEmoji(currentStreak)}
        </span>
      </h1>
      <p className="text-text-secondary mt-1">{getMessage(currentStreak)}</p>
    </div>
  );
}

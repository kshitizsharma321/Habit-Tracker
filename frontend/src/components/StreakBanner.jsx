import { useRef, useEffect, useState } from 'react';
import { calculateStreaks } from '../utils/stats';

const STREAK_EMOJIS = [
  [90, '🏅'],
  [60, '🦄'],
  [30, '💎'],
  [21, '🏆'],
  [14, '🚀'],
  [7, '🔥'],
  [3, '👍'],
  [0, '😢'],
];

const MESSAGES = [
  [30, 'You are unstoppable!'],
  [14, 'Amazing consistency!'],
  [7, 'Great job!'],
  [3, 'Good progress!'],
  [1, 'Great start! Keep going!'],
  [0, 'Start your streak today!'],
];

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

  // Pulse animation on every 7-day milestone
  useEffect(() => {
    if (currentStreak > 0 && currentStreak % 7 === 0) {
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

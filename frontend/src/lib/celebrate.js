import confetti from 'canvas-confetti';
import { getDateKey } from '../utils/dates';
import { notify } from './toast';

// Fireworks burst from both bottom corners. Skipped when the user prefers reduced motion.
function fireworks(duration = 1400) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const end = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };
  const rand = (min, max) => Math.random() * (max - min) + min;
  const interval = setInterval(() => {
    const left = end - Date.now();
    if (left <= 0) return clearInterval(interval);
    const particleCount = 50 * (left / duration);
    confetti({ ...defaults, particleCount, origin: { x: rand(0.1, 0.3), y: Math.random() - 0.2 } });
    confetti({ ...defaults, particleCount, origin: { x: rand(0.7, 0.9), y: Math.random() - 0.2 } });
  }, 250);
}

/**
 * Celebrate a streak milestone — once per milestone per habit, but again on
 * subsequent logins the same day. Returns true if a celebration was shown.
 *
 * Persistence:
 *   localStorage   ht_milestone_<habit>_<m>      = the date the milestone was first reached (permanent)
 *   sessionStorage ht_milestone_seen_<habit>_<m> = shown during this login session
 */
export function celebrateMilestone({ habitId, habitName, milestone }) {
  const today = getDateKey(new Date());
  const permKey = `ht_milestone_${habitId}_${milestone}`;
  const sessKey = `ht_milestone_seen_${habitId}_${milestone}`;
  const reachedOn = localStorage.getItem(permKey);
  const seenThisSession = sessionStorage.getItem(sessKey);

  const firstEver = !reachedOn;
  const reachedToday = reachedOn === today;
  // Show on the first hit, or on a fresh same-day login that hasn't seen it yet.
  if (!firstEver && !(reachedToday && !seenThisSession)) return false;

  if (firstEver) localStorage.setItem(permKey, today);
  sessionStorage.setItem(sessKey, '1');

  fireworks();
  notify.success(`${milestone}-day streak! 🎉`, `"${habitName}" reached ${milestone} days. Keep the chain alive!`);
  return true;
}

import { describe, it, expect } from 'vitest';
import { calculateStreaks, calculateStreaksFromGoal } from '../binary';
import { isGoalMet } from '../numeric';
import { fillMissingDays } from '../shared';
import { getDateKey, parseStoredDate } from '../../dates';

// Date key N days before today (IST), built with the same helpers the app uses
// so the tests hold in any machine timezone.
function key(daysAgo) {
  const d = parseStoredDate(getDateKey(new Date()));
  d.setDate(d.getDate() - daysAgo);
  return getDateKey(d);
}

describe('calculateStreaks (date-aware)', () => {
  it('counts consecutive yes days ending today', () => {
    const data = { [key(2)]: 'yes', [key(1)]: 'yes', [key(0)]: 'yes' };
    expect(calculateStreaks(data)).toEqual({ currentStreak: 3, longestStreak: 3 });
  });

  it('does not zero the streak when today is not yet logged', () => {
    const data = { [key(2)]: 'yes', [key(1)]: 'yes' };
    expect(calculateStreaks(data).currentStreak).toBe(2);
  });

  it('zeroes the current streak when today is logged as a miss', () => {
    const data = { [key(2)]: 'yes', [key(1)]: 'yes', [key(0)]: 'no' };
    expect(calculateStreaks(data).currentStreak).toBe(0);
  });

  it('breaks the streak on a calendar gap — sparse data must not streak across skipped days', () => {
    // yes on day-3, NOTHING on day-2, yes on day-1 and today
    const data = { [key(3)]: 'yes', [key(1)]: 'yes', [key(0)]: 'yes' };
    expect(calculateStreaks(data).currentStreak).toBe(2);
  });

  it('breaks the longest streak on gaps too', () => {
    // 2-run, gap, 3-run (ending yesterday)
    const data = {
      [key(7)]: 'yes', [key(6)]: 'yes',
      [key(3)]: 'yes', [key(2)]: 'yes', [key(1)]: 'yes',
    };
    expect(calculateStreaks(data).longestStreak).toBe(3);
  });

  it('handles empty data', () => {
    expect(calculateStreaks({})).toEqual({ currentStreak: 0, longestStreak: 0 });
  });
});

describe('calculateStreaksFromGoal (quantity habits)', () => {
  it('at_least: days meeting the target count, below-target days break', () => {
    const data = { [key(2)]: 10, [key(1)]: 4, [key(0)]: 12 };
    expect(calculateStreaksFromGoal(data, 8, 'at_least').currentStreak).toBe(1);
  });

  it('at_most: staying under the limit counts, exceeding breaks', () => {
    const data = { [key(2)]: 3, [key(1)]: 1.5, [key(0)]: 1 };
    expect(calculateStreaksFromGoal(data, 2, 'at_most').currentStreak).toBe(2);
  });

  it('a skipped day breaks a quantity streak', () => {
    const data = { [key(3)]: 10, [key(1)]: 10, [key(0)]: 10 };
    expect(calculateStreaksFromGoal(data, 8, 'at_least').currentStreak).toBe(2);
  });

  it('today unlogged does not zero a quantity streak', () => {
    const data = { [key(2)]: 10, [key(1)]: 10 };
    expect(calculateStreaksFromGoal(data, 8, 'at_least').currentStreak).toBe(2);
  });
});

describe('isGoalMet', () => {
  it('at_least: value >= goal succeeds', () => {
    expect(isGoalMet(8, 8, 'at_least')).toBe(true);
    expect(isGoalMet(7.99, 8, 'at_least')).toBe(false);
  });

  it('at_most: value <= goal succeeds (0 is a perfect day)', () => {
    expect(isGoalMet(2, 2, 'at_most')).toBe(true);
    expect(isGoalMet(0, 2, 'at_most')).toBe(true);
    expect(isGoalMet(2.5, 2, 'at_most')).toBe(false);
  });

  it('rejects non-numeric values', () => {
    expect(isGoalMet('yes', 2, 'at_least')).toBe(false);
    expect(isGoalMet(undefined, 2, 'at_most')).toBe(false);
  });
});

describe('fillMissingDays', () => {
  it('fills gaps with "no" but never fills today', () => {
    const data = { [key(3)]: 'yes' };
    const filled = fillMissingDays(data);
    expect(filled[key(2)]).toBe('no');
    expect(filled[key(1)]).toBe('no');
    expect(filled[key(0)]).toBeUndefined();
  });

  it('leaves logged values untouched', () => {
    const data = { [key(2)]: 'yes', [key(1)]: 'no' };
    const filled = fillMissingDays(data);
    expect(filled[key(2)]).toBe('yes');
    expect(filled[key(1)]).toBe('no');
  });
});

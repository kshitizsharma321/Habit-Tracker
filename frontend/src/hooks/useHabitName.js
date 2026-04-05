import { useState } from 'react';

const KEY = 'ht_habit_name';

export function useHabitName() {
  const [name, setName] = useState(() => localStorage.getItem(KEY) ?? 'Habit Tracker');

  const updateName = (newName) => {
    const trimmed = newName.trim();
    if (trimmed) {
      localStorage.setItem(KEY, trimmed);
      setName(trimmed);
    }
  };

  return [name, updateName];
}

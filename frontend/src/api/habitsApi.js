const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

export async function fetchHabits() {
  const res = await fetch(`${API_URL}/habits`);
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}

export async function saveHabit({ date, response }) {
  const res = await fetch(`${API_URL}/habits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, response }),
  });
  if (!res.ok) throw new Error(`Failed to save: ${res.status}`);
  return res.json();
}

// Used only for initial bulk-sync of filled gaps (skipped entries are
// kept frontend-only, only yes/no get persisted here)
export async function bulkSaveHabits(habitData) {
  const res = await fetch(`${API_URL}/habits/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(habitData),
  });
  if (!res.ok) throw new Error(`Bulk save failed: ${res.status}`);
  return res.json();
}

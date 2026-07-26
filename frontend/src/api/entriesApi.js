import { apiFetchJSON } from './client';

export async function fetchEntries(habitId) {
  return apiFetchJSON(`/habit-definitions/${habitId}/entries`);
}

export async function saveEntry(habitId, { date, value }) {
  return apiFetchJSON(`/habit-definitions/${habitId}/entries`, {
    method: 'POST',
    body: JSON.stringify({ date, value }),
  });
}

export async function deleteEntry(habitId, date) {
  return apiFetchJSON(`/habit-definitions/${habitId}/entries/${date}`, {
    method: 'DELETE',
  });
}

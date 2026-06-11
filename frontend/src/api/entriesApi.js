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

export async function bulkSaveEntries(habitId, entries) {
  return apiFetchJSON(`/habit-definitions/${habitId}/entries/bulk`, {
    method: 'POST',
    body: JSON.stringify({ entries }),
  });
}

export async function deleteEntry(habitId, date) {
  return apiFetchJSON(`/habit-definitions/${habitId}/entries/${date}`, {
    method: 'DELETE',
  });
}

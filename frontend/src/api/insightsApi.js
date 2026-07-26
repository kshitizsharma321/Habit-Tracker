import { apiFetchJSON } from './client';

// AI "Coach's note" for one habit. Always resolves { text } — text is null when
// the feature is unconfigured or there is nothing to show.
export async function fetchAiInsight(habitId) {
  return apiFetchJSON('/insights/ai', {
    method: 'POST',
    body: JSON.stringify({ habitId }),
  });
}

// Account-wide daily digest for the Dashboard. Same { text } contract.
export async function fetchAiDigest() {
  return apiFetchJSON('/insights/ai-digest', { method: 'POST' });
}

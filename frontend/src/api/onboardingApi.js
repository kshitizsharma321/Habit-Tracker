import { apiFetchJSON } from './client';

export async function saveOnboarding(data) {
  return apiFetchJSON('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

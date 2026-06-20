import { apiFetchJSON } from './client';

// Marks onboarding as complete on the user's profile.
export async function completeOnboarding(data) {
  return apiFetchJSON('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

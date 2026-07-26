import { apiFetchJSON, apiFetch, setToken, getToken } from './client';

export { setToken, getToken };

export async function register({ username, email, password, name }) {
  return apiFetchJSON('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password, name }),
  });
}

export async function login({ username, password }) {
  return apiFetchJSON('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function checkUsernameAvailability(username) {
  const res = await apiFetch(`/auth/check-username?u=${encodeURIComponent(username)}`);
  return res.json();
}

export async function googleLogin(credential) {
  return apiFetchJSON('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  });
}

export async function fetchMe() {
  return apiFetchJSON('/auth/me');
}

export async function updateProfile(data) {
  return apiFetchJSON('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function changePassword({ currentPassword, newPassword }) {
  return apiFetchJSON('/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

// Always resolves with a generic message (anti-enumeration on the server).
export async function requestPasswordReset(usernameOrEmail) {
  return apiFetchJSON('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ usernameOrEmail }),
  });
}

export async function resetPassword({ token, newPassword }) {
  return apiFetchJSON('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function deleteAccount() {
  return apiFetchJSON('/auth/account', { method: 'DELETE' });
}

// Full-account CSV export — returns { csv, filename } (csv null when no data yet).
export async function exportData() {
  return apiFetchJSON('/auth/export');
}

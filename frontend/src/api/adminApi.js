import { apiFetch, apiFetchJSON } from './client';

export const fetchAdminStats = () => apiFetchJSON('/admin/stats');

export const fetchAdminUsers = () => apiFetchJSON('/admin/users');

export const deleteAdminUser = (userId) =>
  apiFetchJSON(`/admin/users/${userId}`, { method: 'DELETE' });

export const updateAdminRole = (userId, isAdmin) =>
  apiFetchJSON(`/admin/users/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ isAdmin }),
  });

export const fetchAdminUserHabits = (userId) =>
  apiFetchJSON(`/admin/users/${userId}/habits`);

export const fetchAdminUserBackups = (userId) =>
  apiFetchJSON(`/admin/users/${userId}/backups`);

// Returns a raw Response so the caller can stream the blob for download.
export const downloadUserBackup = (userId, date) =>
  apiFetch(`/admin/users/${userId}/backups/${date}/download`);

// Restore from a backup stored in MongoDB (identified by userId + date).
export const restoreFromBackup = ({ date, userId }) =>
  apiFetchJSON('/admin/restore-from-backup', {
    method: 'POST',
    body: JSON.stringify({ date, userId }),
  });

// Restore from an uploaded CSV file (same format as the backup).
// Sends the raw CSV text to the backend for parsing.
export const restoreAdminData = (csvText) =>
  apiFetchJSON('/admin/restore-data', {
    method: 'POST',
    body: JSON.stringify({ csvText }),
  });

// Generate a fresh backup for a user right now (overwrites today's snapshot).
export const generateUserBackup = (userId) =>
  apiFetchJSON(`/admin/users/${userId}/generate-backup`, { method: 'POST' });

// Delete a specific backup snapshot by date.
export const deleteUserBackup = (userId, date) =>
  apiFetchJSON(`/admin/users/${userId}/backups/${date}`, { method: 'DELETE' });

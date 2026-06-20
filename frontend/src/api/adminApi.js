import { apiFetchJSON } from './client';

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

// The single latest backup for a user (or null).
export const fetchAdminUserBackup = (userId) =>
  apiFetchJSON(`/admin/users/${userId}/backup`);

// Backups whose user was deleted — recoverable accounts.
export const fetchOrphanedBackups = () => apiFetchJSON('/admin/orphaned-backups');

// Returns { signedUrl } — a short-lived Supabase signed URL for direct browser download.
export const downloadUserBackup = (userId) =>
  apiFetchJSON(`/admin/users/${userId}/backup/download`);

// Restore a user from their stored backup. `newUserPassword` recreates a deleted account.
export const restoreFromBackup = ({ userId, newUserPassword }) =>
  apiFetchJSON('/admin/restore-from-backup', {
    method: 'POST',
    body: JSON.stringify({ userId, newUserPassword }),
  });

// Restore from an uploaded CSV file (same format as the backup).
// `newUserPassword` recreates any accounts named in the CSV that no longer exist.
export const restoreFromUploadedCsv = (csvText, newUserPassword) =>
  apiFetchJSON('/admin/restore-from-csv', {
    method: 'POST',
    body: JSON.stringify({ csvText, newUserPassword }),
  });

// Generate a fresh backup for a user right now (overwrites their single backup).
export const generateUserBackup = (userId) =>
  apiFetchJSON(`/admin/users/${userId}/generate-backup`, { method: 'POST' });

// Delete a user's backup.
export const deleteUserBackup = (userId) =>
  apiFetchJSON(`/admin/users/${userId}/backup`, { method: 'DELETE' });

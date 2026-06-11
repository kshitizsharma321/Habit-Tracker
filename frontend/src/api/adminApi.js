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

export const restoreAdminData = (data) =>
  apiFetchJSON('/admin/restore-data', {
    method: 'POST',
    body: JSON.stringify({ data }),
  });

export const fetchAdminBackups = () => apiFetchJSON('/admin/backups');

export const restoreFromBackup = (date) =>
  apiFetchJSON('/admin/restore-from-backup', {
    method: 'POST',
    body: JSON.stringify({ date }),
  });
import { apiFetchJSON } from './client';

export async function fetchDefinitions() {
  return apiFetchJSON('/habit-definitions');
}

export async function createDefinition(data) {
  return apiFetchJSON('/habit-definitions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function bulkCreateDefinitions(habits) {
  return apiFetchJSON('/habit-definitions/bulk', {
    method: 'POST',
    body: JSON.stringify({ habits }),
  });
}

export async function updateDefinition(id, data) {
  return apiFetchJSON(`/habit-definitions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteDefinition(id) {
  return apiFetchJSON(`/habit-definitions/${id}`, {
    method: 'DELETE',
  });
}

export async function reorderDefinitions(orderedIds) {
  return apiFetchJSON('/habit-definitions/reorder', {
    method: 'PUT',
    body: JSON.stringify({ orderedIds }),
  });
}

export async function fetchDashboard() {
  return apiFetchJSON('/habit-definitions/dashboard');
}

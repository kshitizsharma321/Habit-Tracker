// Dev fallback is RELATIVE on purpose: vite.config.js proxies /api → localhost:3000,
// so local dev needs no env var at all. It must never be an absolute localhost URL —
// Vite inlines this string at BUILD time, so a prod build missing VITE_API_URL would
// permanently bake "http://localhost:3000/api" into the shipped bundle and every call
// would die as blocked mixed content in the user's browser. vite.config.js fails the
// production build outright if VITE_API_URL is unset, so that can't reach a deploy.
const API_URL = import.meta.env.VITE_API_URL ?? '/api';

const TOKEN_KEY = 'ht_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

// A 401 only means "session expired" when the request actually carried a token.
// Login/register also answer 401 (wrong password) — reloading there would wipe
// the error message the user is trying to read.
function handleAuthError(res, hadToken) {
  if (res.status === 401 && hadToken) {
    setToken(null);
    window.location.reload();
  }
  return res;
}

export async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  const token = getToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return handleAuthError(res, !!token);
}

export async function apiFetchJSON(path, options = {}) {
  const res = await apiFetch(path, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

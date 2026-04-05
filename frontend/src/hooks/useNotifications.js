import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

const LS_TIME_KEY    = 'ht_reminder_time';
const LS_ENABLED_KEY = 'ht_reminder_enabled';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function useNotifications() {
  const isSupported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  const [permission, setPermission] = useState(
    isSupported ? Notification.permission : 'denied'
  );
  const [isEnabled, setIsEnabled] = useState(
    () => localStorage.getItem(LS_ENABLED_KEY) === 'true'
  );
  const [reminderTime, setReminderTime] = useState(
    () => localStorage.getItem(LS_TIME_KEY) ?? '21:00'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  // On mount: verify the Service Worker push subscription still exists
  useEffect(() => {
    if (!isSupported || !isEnabled) return;
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        // Subscription was lost (e.g. browser data cleared)
        setIsEnabled(false);
        localStorage.setItem(LS_ENABLED_KEY, 'false');
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enable = useCallback(async (time) => {
    if (!isSupported) return;
    if (!VAPID_PUBLIC_KEY) {
      setError('VAPID public key not configured. See README setup guide.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 1. Ask for browser permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') throw new Error('Notification permission was denied');

      // 2. Register Service Worker and wait until it's fully ACTIVE
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      // navigator.serviceWorker.ready resolves only when a SW is active —
      // using reg directly may still be in 'installing' state and fail to subscribe
      const readyReg = await navigator.serviceWorker.ready;

      // 3. Subscribe to Web Push
      const sub = await readyReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // 4. Save subscription + reminder time on the backend
      const res = await fetch(`${API_URL}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), reminderTime: time }),
      });
      if (!res.ok) throw new Error('Failed to save subscription on server');

      setIsEnabled(true);
      localStorage.setItem(LS_ENABLED_KEY, 'true');
      setReminderTime(time);
      localStorage.setItem(LS_TIME_KEY, time);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const disable = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`${API_URL}/subscriptions`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setIsEnabled(false);
      localStorage.setItem(LS_ENABLED_KEY, 'false');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update reminder time — saves locally + pushes to backend if currently enabled
  const updateTime = useCallback(async (time) => {
    setReminderTime(time);
    localStorage.setItem(LS_TIME_KEY, time);
    if (!isEnabled) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      await fetch(`${API_URL}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), reminderTime: time }),
      });
    } catch { /* non-critical — time saved locally already */ }
  }, [isEnabled]);

  // Trigger an immediate test push — useful to verify the full pipeline works
  const testPush = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/test-push`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Test push failed');
      if (data.sent === 0) throw new Error('Push sent but no subscriptions found — try re-enabling reminders');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { isSupported, permission, isEnabled, reminderTime, loading, error, enable, disable, updateTime, testPush };
}

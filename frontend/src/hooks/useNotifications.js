import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';

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
  const [pushReceived, setPushReceived] = useState(false);

  useEffect(() => {
    if (!isSupported || !isEnabled) return;
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setIsEnabled(false);
        localStorage.setItem(LS_ENABLED_KEY, 'false');
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isSupported) return;
    const handler = (event) => {
      if (event.data?.type === 'PUSH_RECEIVED') {
        setPushReceived(true);
        setTimeout(() => setPushReceived(false), 8000);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [isSupported]);

  const enable = useCallback(async (time) => {
    if (!isSupported) return;
    if (!VAPID_PUBLIC_KEY) {
      setError('VAPID public key not configured. See README setup guide.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') throw new Error('Notification permission was denied');

      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const readyReg = await navigator.serviceWorker.ready;

      const sub = await readyReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const res = await apiFetch('/subscriptions', {
        method: 'POST',
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
        await apiFetch('/subscriptions', {
          method: 'DELETE',
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

  const updateTime = useCallback(async (time) => {
    setReminderTime(time);
    localStorage.setItem(LS_TIME_KEY, time);
    if (!isEnabled) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      await apiFetch('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ subscription: sub.toJSON(), reminderTime: time }),
      });
    } catch { /* non-critical */ }
  }, [isEnabled]);

  const testPush = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPushReceived(false);
    try {
      const swReg = await navigator.serviceWorker.ready;
      const sub = await swReg.pushManager.getSubscription();
      if (!sub) {
        throw new Error('No push subscription found in this browser — disable and re-enable reminders to create one');
      }
      const res = await apiFetch('/test-push', {
        method: 'POST',
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Test push failed');
      if (data.sent === 0) throw new Error(data.message ?? 'Subscription not found on server — disable and re-enable reminders');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { isSupported, permission, isEnabled, reminderTime, loading, error, pushReceived, enable, disable, updateTime, testPush };
}

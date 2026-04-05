// Service Worker — handles push events and notification clicks

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  console.log('[SW] push event received', data);

  // Notify all open clients so the app can show in-app feedback
  // This also lets us verify the SW is receiving pushes even if OS blocks notifications
  const notifyClients = clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      clientList.forEach((c) => c.postMessage({ type: 'PUSH_RECEIVED', data }));
    });

  const showNotif = self.registration
    .showNotification(data.title || '⏰ Habit Reminder', {
      body: data.body || "Don't forget to log your habit today! 🌿",
      tag: 'habit-reminder',
      renotify: true,
    })
    .then(() => console.log('[SW] notification shown'))
    .catch((err) => console.error('[SW] showNotification failed:', err));

  event.waitUntil(Promise.all([notifyClients, showNotif]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing tab if open, otherwise open a new one
        for (const client of clientList) {
          if ('focus' in client) return client.focus();
        }
        return clients.openWindow('/');
      })
  );
});

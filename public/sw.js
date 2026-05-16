self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || 'Diabo';
  const body = data.body || 'Vous avez un rappel Diabo.';
  const url = data.url || '/reminders';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/reminders';
  event.waitUntil(clients.openWindow(url));
});

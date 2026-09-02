export function buildServiceWorkerFcmHandlers() {
  return `// FCM_NOTIFICATION_HANDLER_START
messaging.onBackgroundMessage(function (payload) {
  var data = (payload && payload.data) || {};
  var options = { 
    body: String(data.body || ''), 
    icon: '/icons/icon-192.png',
    badge: '/icons/notification-badge.png', 
    data: { url: String(data.url || '/') },
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    silent: false
  };
  var work = [self.registration.showNotification(String(data.title || 'Notifikasi Baru'), options)];
  if (self.navigator && typeof self.navigator.setAppBadge === 'function') work.push(self.navigator.setAppBadge(1).catch(function () {}));
  return Promise.all(work);
});
// FCM_NOTIFICATION_HANDLER_END`;
}

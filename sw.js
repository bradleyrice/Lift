var CACHE = 'lift-v3';

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', function(e) {
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(function() {
      return caches.match(e.request);
    }));
    return;
  }
});

// Store scheduled timer
var scheduledTimer = null;

self.addEventListener('message', function(e) {
  if (!e.data) return;

  // Schedule a notification at a future timestamp
  if (e.data.type === 'scheduleNotify') {
    if (scheduledTimer) clearTimeout(scheduledTimer);
    var delay = e.data.fireAt - Date.now();
    if (delay <= 0) return;
    scheduledTimer = setTimeout(function() {
      self.registration.showNotification(e.data.title, {
        body: e.data.body,
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        vibrate: [200, 100, 200],
        requireInteraction: false,
        tag: 'rest-timer'
      });
      scheduledTimer = null;
    }, delay);
  }

  // Cancel any scheduled notification (timer stopped/reset)
  if (e.data.type === 'cancelNotify') {
    if (scheduledTimer) {
      clearTimeout(scheduledTimer);
      scheduledTimer = null;
    }
  }

  // Legacy immediate notify (foreground fallback)
  if (e.data.type === 'notify') {
    self.registration.showNotification(e.data.title, {
      body: e.data.body,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'rest-timer'
    });
  }
});

var APP_SHELL_CACHE = 'lift-shell-v8';
var APP_SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './sw.js'
];

function scopeRelativePath(url) {
  var scopePath = new URL(self.registration.scope).pathname;
  var path = url.pathname;
  if (path.indexOf(scopePath) !== 0) return '';
  var rel = path.slice(scopePath.length);
  return './' + rel;
}

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(APP_SHELL_CACHE).then(function(cache) {
      return cache.addAll(APP_SHELL_ASSETS);
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) {
        if (k !== APP_SHELL_CACHE && k.indexOf('lift-') === 0) return caches.delete(k);
      }));
    }).then(function() {
      return clients.claim();
    })
  );
});

self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(function() {
      return caches.match('./index.html');
    }));
    return;
  }

  if (e.request.method === 'GET' && APP_SHELL_ASSETS.indexOf(scopeRelativePath(url)) >= 0) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        return cached || fetch(e.request);
      })
    );
  }
});

// Scheduled notification: store fireAt + payload, use setTimeout
// NOTE: Service workers can be killed by the browser when idle (especially on iOS),
// so this works reliably when the app is foregrounded or recently backgrounded,
// but cannot be guaranteed on a locked iOS screen without a push server.
var scheduledTimer = null;
var scheduledPayload = null;

function scheduleNext() {
  if (!scheduledPayload) return;
  var delay = scheduledPayload.fireAt - Date.now();
  if (delay <= 0) {
    // Already past — fire immediately
    self.registration.showNotification(scheduledPayload.title, {
      body: scheduledPayload.body,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      vibrate: [200, 100, 200],
      requireInteraction: false,
      tag: 'rest-timer'
    });
    scheduledPayload = null;
    return;
  }
  if (scheduledTimer) clearTimeout(scheduledTimer);
  scheduledTimer = setTimeout(function() {
    if (!scheduledPayload) return;
    self.registration.showNotification(scheduledPayload.title, {
      body: scheduledPayload.body,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      vibrate: [200, 100, 200],
      requireInteraction: false,
      tag: 'rest-timer'
    });
    scheduledPayload = null;
    scheduledTimer = null;
  }, delay);
}

self.addEventListener('message', function(e) {
  if (!e.data) return;

  if (e.data.type === 'scheduleNotify') {
    scheduledPayload = { title: e.data.title, body: e.data.body, fireAt: e.data.fireAt };
    scheduleNext();
  }

  if (e.data.type === 'cancelNotify') {
    if (scheduledTimer) { clearTimeout(scheduledTimer); scheduledTimer = null; }
    scheduledPayload = null;
  }

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

// When SW wakes for any reason, reschedule if we have a pending payload
// (helps recover if SW was briefly suspended)
self.addEventListener('activate', function() {
  scheduleNext();
});

// Handle incoming push events from the LIFT push server
self.addEventListener('push', function(e) {
  var title = 'Rest Complete';
  var body = 'Time to lift!';
  try {
    if (e.data) {
      var data = e.data.json();
      if (data.title) title = data.title;
      if (data.body) body = data.body;
    }
  } catch(err) {}
  e.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      vibrate: [200, 100, 200],
      requireInteraction: false,
      tag: 'rest-timer'
    })
  );
});

// Tap on notification opens/focuses the app
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf('/lift/') !== -1) {
          return list[i].focus();
        }
      }
      return clients.openWindow('/lift/');
    })
  );
});

// MedHC Service Worker v1.0
// Maneja cache offline y notificaciones push

const CACHE_NAME = 'medhc-v1';
const ASSETS = [
  './MedHC_Final.html',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap'
];

// ── INSTALACIÓN: guarda archivos en cache ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(() => {
        // Si falla algún asset externo, no bloquear instalación
        return cache.add('./MedHC_Final.html');
      });
    })
  );
  self.skipWaiting();
});

// ── ACTIVACIÓN: limpia caches viejos ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: sirve desde cache si no hay internet ──
self.addEventListener('fetch', event => {
  // No interceptar llamadas a Firebase ni a Anthropic API
  const url = event.request.url;
  if (
    url.includes('firebaseio.com') ||
    url.includes('googleapis.com/identitytoolkit') ||
    url.includes('api.anthropic.com') ||
    url.includes('securetoken.google.com')
  ) {
    return; // Dejar pasar directo a la red
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cachear respuestas válidas
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Sin internet: devolver página principal desde cache
        if (event.request.destination === 'document') {
          return caches.match('./MedHC_Final.html');
        }
      });
    })
  );
});

// ── NOTIFICACIONES PUSH (para futuro uso con servidor) ──
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'MedHC';
  const options = {
    body: data.body || 'Tienes una cita próxima',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: data.tag || 'medhc-notif',
    requireInteraction: data.urgent || false,
    vibrate: data.urgent ? [300, 100, 300, 100, 300] : [200, 100, 200],
    data: { url: data.url || './MedHC_Final.html' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Al tocar la notificación: abrir la app ──
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './MedHC_Final.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('MedHC') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

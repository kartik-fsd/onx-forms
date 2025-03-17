// public/service-worker.js

const CACHE_NAME = 'fse-lead-collection-v1';

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icons/pwa-192x192.png',
    '/icons/pwa-512x512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, falling back to network
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // For API requests, try network first, then cache
    if (event.request.url.includes('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const clonedResponse = response.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => cache.put(event.request, clonedResponse));
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request)
                        .then((cachedResponse) => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }

                            // If it's a POST request and we're offline, save it to IndexedDB for later
                            if (event.request.method === 'POST') {
                                // This would be handled by the sync manager in a real app
                                return new Response(JSON.stringify({
                                    success: false,
                                    offline: true,
                                    message: 'Your data has been saved and will be submitted when you are back online.'
                                }), {
                                    headers: { 'Content-Type': 'application/json' }
                                });
                            }

                            return new Response('Network error');
                        });
                })
        );
        return;
    }

    // For other requests, try cache first, falling back to network
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then((response) => {
                        // Don't cache non-success responses
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        const clonedResponse = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => cache.put(event.request, clonedResponse));
                        return response;
                    });
            })
    );
});

// Background sync for offline form submissions
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-forms') {
        event.waitUntil(syncForms());
    }
});

// Function to sync forms when back online
async function syncForms() {
    // This would normally interact with IndexedDB to get pending submissions
    // For demonstration purposes, we'll just log a message
    console.log('Syncing pending form submissions...');

    // In a real implementation, you would:
    // 1. Open IndexedDB
    // 2. Get all pending form submissions
    // 3. Send them to the server one by one
    // 4. Update their status in IndexedDB

    return Promise.resolve();
}

// Listen for push notifications
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();

    const options = {
        body: data.body || 'New notification',
        icon: '/icons/pwa-192x192.png',
        badge: '/icons/pwa-192x192.png',
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'FSE Lead Collection', options)
    );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window' })
            .then((clientList) => {
                // Check if there's already a window open
                for (const client of clientList) {
                    if (client.url === event.notification.data.url && 'focus' in client) {
                        return client.focus();
                    }
                }

                // If not, open a new window
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data.url);
                }
            })
    );
});

// Network status detection
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'NETWORK_STATUS') {
        const isOnline = event.data.isOnline;

        // Notify all clients of the network status change
        self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
                client.postMessage({
                    type: 'NETWORK_STATUS_CHANGE',
                    isOnline
                });
            });
        });

        // If we're back online, attempt to sync
        if (isOnline) {
            self.registration.sync.register('sync-forms');
        }
    }
});
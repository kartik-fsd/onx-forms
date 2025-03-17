// Cache names with versioning to help with updates
const STATIC_CACHE = 'fse-static-v1';
const DYNAMIC_CACHE = 'fse-dynamic-v1';
const FORM_CACHE = 'fse-forms-v1';
const API_CACHE = 'fse-api-v1';
const IMAGE_CACHE = 'fse-images-v1';

// Assets to cache immediately on service worker install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/assets/css/main.css',
    '/assets/js/main.js',
    '/assets/icons/app-icon-48x48.png',
    '/assets/icons/app-icon-96x96.png',
    '/assets/icons/app-icon-144x144.png',
    '/assets/icons/app-icon-192x192.png',
    '/assets/icons/app-icon-256x256.png',
    '/assets/icons/app-icon-384x384.png',
    '/assets/icons/app-icon-512x512.png',
    '/offline.html'
];

// Install event - cache static assets and create empty dynamic caches
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing Service Worker');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('[Service Worker] Pre-caching App Shell');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                // Create empty dynamic caches
                return Promise.all([
                    caches.open(DYNAMIC_CACHE),
                    caches.open(FORM_CACHE),
                    caches.open(API_CACHE),
                    caches.open(IMAGE_CACHE)
                ]);
            })
            .then(() => {
                console.log('[Service Worker] Successfully pre-cached resources');
                return self.skipWaiting();
            })
            .catch(err => {
                console.error('[Service Worker] Error during pre-caching:', err);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating Service Worker');

    event.waitUntil(
        // Get all cache keys
        caches.keys()
            .then(keyList => {
                return Promise.all(keyList.map(key => {
                    // Remove any old cache with our prefix but not in our defined list
                    if (
                        key !== STATIC_CACHE &&
                        key !== DYNAMIC_CACHE &&
                        key !== FORM_CACHE &&
                        key !== API_CACHE &&
                        key !== IMAGE_CACHE &&
                        key.startsWith('fse-')
                    ) {
                        console.log('[Service Worker] Removing old cache:', key);
                        return caches.delete(key);
                    }
                }));
            })
            .then(() => {
                console.log('[Service Worker] Claiming clients');
                return self.clients.claim();
            })
    );

    return self.clients.claim();
});

// Helper function for network-first strategy
const networkFirst = async (request, cacheName) => {
    try {
        // Try network first
        const networkResponse = await fetch(request);

        // Clone the response before using it
        const responseToCache = networkResponse.clone();

        // Cache the response for future use
        const cache = await caches.open(cacheName);
        await cache.put(request, responseToCache);

        return networkResponse;
    } catch (err) {
        // If network fails, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // If no cache, throw error
        throw err;
    }
};

// Helper function for cache-first strategy
const cacheFirst = async (request, cacheName) => {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        // If not in cache, try network
        const networkResponse = await fetch(request);

        // Clone the response before using it
        const responseToCache = networkResponse.clone();

        // Cache the response for future use
        const cache = await caches.open(cacheName);
        await cache.put(request, responseToCache);

        return networkResponse;
    } catch (err) {
        // If both fail, throw error
        throw err;
    }
};

// Helper function for stale-while-revalidate strategy
const staleWhileRevalidate = async (request, cacheName) => {
    // Start fetching from network
    const fetchPromise = fetch(request).then(networkResponse => {
        const responseToCache = networkResponse.clone();
        caches.open(cacheName).then(cache => {
            cache.put(request, responseToCache);
        });
        return networkResponse;
    });

    // Try from cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        // Return cache immediately but update in background
        fetchPromise.catch(err => {
            console.log('[Service Worker] Error updating cache:', err);
        });
        return cachedResponse;
    }

    // If not in cache, wait for network
    return fetchPromise;
};

// Determine appropriate caching strategy based on request
const applyStrategy = (request) => {
    const url = new URL(request.url);

    // Form definitions - network first with cache fallback
    if (url.pathname.startsWith('/api/forms/') && request.method === 'GET') {
        return networkFirst(request, FORM_CACHE);
    }

    // API responses for GET requests - network first with cache fallback
    if (url.pathname.startsWith('/api/') && request.method === 'GET') {
        return networkFirst(request, API_CACHE);
    }

    // POST requests can't be cached, handle differently
    if (request.method === 'POST') {
        return fetch(request).catch(err => {
            // If it's a form submission, we should queue it for later
            if (url.pathname.startsWith('/api/submissions')) {
                // This would be handled by the background sync mechanism
                console.log('[Service Worker] Queuing form submission for later');

                // Return a mock response for now
                return new Response(JSON.stringify({
                    success: false,
                    offline: true,
                    message: 'You are offline. Your submission has been saved and will be uploaded when you are online.'
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            throw err;
        });
    }

    // Images - cache first with network fallback
    if (
        request.destination === 'image' ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.jpeg') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.gif')
    ) {
        return cacheFirst(request, IMAGE_CACHE);
    }

    // Static assets - cache first
    if (
        request.destination === 'style' ||
        request.destination === 'script' ||
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.js')
    ) {
        return cacheFirst(request, STATIC_CACHE);
    }

    // HTML pages - network first
    if (request.destination === 'document') {
        return networkFirst(request, DYNAMIC_CACHE);
    }

    // Default stale-while-revalidate for anything else
    return staleWhileRevalidate(request, DYNAMIC_CACHE);
};

// Fetch event - apply appropriate caching strategy
self.addEventListener('fetch', event => {
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        applyStrategy(event.request)
            .catch(err => {
                console.log('[Service Worker] Fetch failed, serving offline page instead:', err);

                // If fetch fails, try to return offline page for navigation requests
                if (event.request.destination === 'document') {
                    return caches.match('/offline.html');
                }

                // For API requests, return a JSON error
                if (event.request.url.includes('/api/')) {
                    return new Response(JSON.stringify({
                        success: false,
                        offline: true,
                        error: 'You are currently offline'
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // For other requests, just propagate the error
                throw err;
            })
    );
});

// Background sync for form submissions
self.addEventListener('sync', event => {
    console.log('[Service Worker] Background Sync event:', event.tag);

    if (event.tag === 'form-sync') {
        event.waitUntil(syncForms());
    }

    if (event.tag === 'media-upload-sync') {
        event.waitUntil(syncMedia());
    }
});

// Sync form submissions
async function syncForms() {
    try {
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_FORMS'
            });
        });

        return new Promise((resolve) => {
            // Set up message listener for sync completion
            self.addEventListener('message', function syncListener(event) {
                if (event.data && event.data.type === 'SYNC_FORMS_COMPLETE') {
                    self.removeEventListener('message', syncListener);
                    resolve();
                }
            });

            // Set a timeout in case sync takes too long
            setTimeout(() => {
                self.removeEventListener('message', syncListener);
                resolve();
            }, 60000); // 1 minute timeout
        });
    } catch (error) {
        console.error('[Service Worker] Error syncing forms:', error);
        throw error;
    }
}

// Sync media uploads
async function syncMedia() {
    try {
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_MEDIA'
            });
        });

        return new Promise((resolve) => {
            // Set up message listener for sync completion
            self.addEventListener('message', function syncListener(event) {
                if (event.data && event.data.type === 'SYNC_MEDIA_COMPLETE') {
                    self.removeEventListener('message', syncListener);
                    resolve();
                }
            });

            // Set a timeout in case sync takes too long
            setTimeout(() => {
                self.removeEventListener('message', syncListener);
                resolve();
            }, 300000); // 5 minute timeout for media (can be larger files)
        });
    } catch (error) {
        console.error('[Service Worker] Error syncing media:', error);
        throw error;
    }
}

// Handle notifications
self.addEventListener('push', event => {
    let notification = {
        title: 'New Notification',
        options: {
            body: 'This is a notification from FSE Lead Collection System',
            icon: '/assets/icons/app-icon-96x96.png',
            badge: '/assets/icons/app-icon-96x96.png'
        }
    };

    if (event.data) {
        const data = event.data.json();
        notification = {
            title: data.title || notification.title,
            options: {
                ...notification.options,
                body: data.body || notification.options.body,
                data: data.data || {}
            }
        };
    }

    event.waitUntil(
        self.registration.showNotification(notification.title, notification.options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    const notification = event.notification;
    notification.close();

    let urlToOpen = '/';

    if (notification.data && notification.data.url) {
        urlToOpen = notification.data.url;
    }

    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then(clients => {
            // Check if there's already a window open
            const hadWindowToFocus = clients.some(client => {
                if (client.url === urlToOpen) {
                    client.focus();
                    return true;
                }

                return false;
            });

            // Open a new window if needed
            if (!hadWindowToFocus) {
                clients.openWindow(urlToOpen);
            }
        })
    );
});

// Listen for messages from the app
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
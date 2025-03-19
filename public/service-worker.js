// Cache names with versioning
const CACHE_VERSION = 'v2';
const STATIC_CACHE = `fse-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `fse-dynamic-${CACHE_VERSION}`;
const FORM_CACHE = `fse-forms-${CACHE_VERSION}`;
const API_CACHE = `fse-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `fse-images-${CACHE_VERSION}`;

// Assets to cache immediately on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/offline.html',
    '/assets/index.css',
    '/assets/index.js',
    '/assets/icons/icon-72x72.png',
    '/assets/icons/icon-96x96.png',
    '/assets/icons/icon-128x128.png',
    '/assets/icons/icon-144x144.png',
    '/assets/icons/icon-152x152.png',
    '/assets/icons/icon-192x192.png',
    '/assets/icons/icon-384x384.png',
    '/assets/icons/icon-512x512.png'
];

// Configuration for sync events
const SYNC_CONFIG = {
    'sync-forms': {
        maxRetries: 5,
        minBackoff: 60000, // 1 minute
        maxBackoff: 86400000 // 24 hours
    },
    'sync-media': {
        maxRetries: 3,
        minBackoff: 300000, // 5 minutes
        maxBackoff: 3600000 // 1 hour
    }
};

// Track sync attempts
const syncAttempts = new Map();

// Install event - cache static assets
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

    const currentCaches = [
        STATIC_CACHE,
        DYNAMIC_CACHE,
        FORM_CACHE,
        API_CACHE,
        IMAGE_CACHE
    ];

    event.waitUntil(
        caches.keys()
            .then(keyList => {
                return Promise.all(keyList.map(key => {
                    // Remove any old cache with our prefix but not in our current list
                    if (!currentCaches.includes(key) && key.startsWith('fse-')) {
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
});

// Helper function for network-first strategy
const networkFirst = async (request, cacheName) => {
    try {
        // Try network first
        const networkResponse = await fetch(request);

        // Cache the response for future use
        const responseToCache = networkResponse.clone();
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

        // Cache the response for future use
        const responseToCache = networkResponse.clone();
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
        // Don't cache non-successful responses
        if (!networkResponse.ok) {
            return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(cacheName).then(cache => {
            cache.put(request, responseToCache);
        });

        return networkResponse;
    }).catch(err => {
        console.warn('[Service Worker] Network fetch failed:', err);
        // Return the error so we can still use cached response
        return Promise.reject(err);
    });

    // Try from cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        // Return cache immediately but update in background
        fetchPromise.catch(() => {
            // Silently handle network errors when updating cache
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
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
        return handleMutation(request);
    }

    // Images - cache first with network fallback
    if (
        request.destination === 'image' ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.jpeg') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.gif') ||
        url.pathname.endsWith('.webp')
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

// Handle mutation requests (POST, PUT, DELETE)
const handleMutation = async (request) => {
    // Try to send the request to the server
    try {
        return await fetch(request.clone());
    } catch (err) {
        // If offline, queue the request for later
        if (!navigator.onLine) {
            await queueRequest(request.clone());

            // Return a mock response indicating offline storage
            return new Response(
                JSON.stringify({
                    success: false,
                    offline: true,
                    message: 'You are offline. Your request has been saved and will be processed when you are online.'
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        // If online but fetch failed for other reasons, propagate the error
        throw err;
    }
};

// Queue a request for later processing
const queueRequest = async (request) => {
    try {
        // Clone the request to ensure we can read its body
        const requestClone = request.clone();
        const url = new URL(request.url);

        // Determine what type of sync to use
        let syncTag;

        if (url.pathname.startsWith('/api/submissions')) {
            syncTag = 'sync-forms';
        } else if (url.pathname.startsWith('/api/media')) {
            syncTag = 'sync-media';
        } else {
            syncTag = 'sync-general';
        }

        // Extract request data
        const requestData = {
            url: request.url,
            method: request.method,
            headers: Object.fromEntries(request.headers.entries()),
            credentials: request.credentials,
            mode: request.mode,
            referrer: request.referrer,
            body: await readRequestBody(requestClone),
            timestamp: Date.now()
        };

        // Store request in IndexedDB for later
        await saveQueuedRequest(syncTag, requestData);

        // Register for background sync
        await registerForSync(syncTag);

        console.log(`[Service Worker] Request queued for background sync: ${syncTag}`);
    } catch (error) {
        console.error('[Service Worker] Failed to queue request:', error);
    }
};

// Read request body based on content type
const readRequestBody = async (request) => {
    const contentType = request.headers.get('Content-Type') || '';

    // Handle different content types
    if (contentType.includes('application/json')) {
        return await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData();
        return Object.fromEntries(formData.entries());
    } else if (contentType.includes('multipart/form-data')) {
        // For file uploads, we need to handle them specially
        // This is just a placeholder - in a real implementation, you would
        // store the files separately
        return 'FORM_DATA_WITH_FILES';
    } else {
        // For other types, get as text
        return await request.text();
    }
};

// IndexedDB helper for request queue
const dbPromise = idb.openDB('fse-offline-requests', 1, {
    upgrade(db) {
        db.createObjectStore('requests', { keyPath: 'id', autoIncrement: true });
    }
});

// Save a request to the queue
const saveQueuedRequest = async (tag, requestData) => {
    const db = await dbPromise;
    return db.add('requests', {
        tag,
        data: requestData,
        status: 'pending',
        retries: 0,
        createdAt: Date.now()
    });
};

// Get all pending requests for a tag
const getPendingRequests = async (tag) => {
    const db = await dbPromise;
    return db.getAllFromIndex('requests', 'tag', tag);
};

// Delete a request from the queue
const deleteQueuedRequest = async (id) => {
    const db = await dbPromise;
    return db.delete('requests', id);
};

// Update a request in the queue
const updateQueuedRequest = async (id, updates) => {
    const db = await dbPromise;
    const request = await db.get('requests', id);
    if (!request) return;

    Object.assign(request, updates);
    return db.put('requests', request);
};

// Register for background sync
const registerForSync = async (tag) => {
    if ('SyncManager' in self) {
        try {
            await self.registration.sync.register(tag);
        } catch (err) {
            console.error(`[Service Worker] Failed to register for ${tag} sync:`, err);
        }
    }
};

// Fetch event - apply appropriate caching strategy
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Skip cross-origin requests to reduce complexity
    if (url.origin !== location.origin) {
        return;
    }

    // Skip the Chrome extension requests
    if (url.pathname.startsWith('/chrome-extension/')) {
        return;
    }

    event.respondWith(
        applyStrategy(event.request)
            .catch(err => {
                console.log('[Service Worker] Fetch failed, serving offline content:', err);

                // If fetch fails, try to return offline page for navigation requests
                if (event.request.destination === 'document') {
                    return caches.match('/offline.html');
                }

                // For API requests, return a JSON error
                if (url.pathname.startsWith('/api/')) {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            offline: true,
                            error: 'You are currently offline. Your request cannot be processed.'
                        }),
                        {
                            status: 503,
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                }

                // For other requests, propagate the error
                throw err;
            })
    );
});

// Background sync for form submissions and media uploads
self.addEventListener('sync', event => {
    console.log('[Service Worker] Background Sync event:', event.tag);

    if (event.tag.startsWith('sync-')) {
        event.waitUntil(processSyncEvent(event.tag));
    }
});

// Process a sync event
const processSyncEvent = async (tag) => {
    console.log(`[Service Worker] Processing sync event: ${tag}`);

    // Initialize sync attempts tracking if needed
    if (!syncAttempts.has(tag)) {
        syncAttempts.set(tag, {
            count: 0,
            lastAttempt: 0
        });
    }

    const tagAttempts = syncAttempts.get(tag);
    tagAttempts.count++;
    tagAttempts.lastAttempt = Date.now();

    // Check if we've exceeded max retries
    const config = SYNC_CONFIG[tag] || { maxRetries: 5, minBackoff: 60000, maxBackoff: 86400000 };

    if (tagAttempts.count > config.maxRetries) {
        console.log(`[Service Worker] Max retries exceeded for ${tag}, giving up`);
        notifyClients('SYNC_FAILED', { tag, error: 'Max retries exceeded' });
        syncAttempts.delete(tag);
        return;
    }

    try {
        // Get all pending requests for this tag
        const pendingRequests = await getPendingRequests(tag);

        if (pendingRequests.length === 0) {
            console.log(`[Service Worker] No pending requests for ${tag}`);
            return;
        }

        console.log(`[Service Worker] Found ${pendingRequests.length} pending requests for ${tag}`);

        // Process each request
        const results = {
            processed: 0,
            successful: 0,
            failed: 0
        };

        for (const request of pendingRequests) {
            results.processed++;

            try {
                // Skip requests with too many retries
                if (request.retries >= config.maxRetries) {
                    console.log(`[Service Worker] Request ${request.id} has exceeded max retries, skipping`);
                    results.failed++;
                    continue;
                }

                // Reconstruct the request
                const originalRequest = await reconstructRequest(request.data);

                // Try to send the request
                const response = await fetch(originalRequest);

                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }

                // Request was successful, remove from queue
                await deleteQueuedRequest(request.id);
                results.successful++;
            } catch (error) {
                // Update retry count
                await updateQueuedRequest(request.id, {
                    status: 'error',
                    retries: request.retries + 1,
                    lastError: error.message,
                    lastAttempt: Date.now()
                });

                results.failed++;
                console.error(`[Service Worker] Failed to process request ${request.id}:`, error);
            }
        }

        // Notify clients of sync completion
        notifyClients('SYNC_COMPLETED', {
            tag,
            results,
            timestamp: new Date().toISOString()
        });

        // Reset retry count on success
        if (results.failed === 0) {
            syncAttempts.delete(tag);
        }
    } catch (error) {
        console.error(`[Service Worker] Error processing sync for ${tag}:`, error);

        // Calculate backoff time
        const backoffTime = Math.min(
            config.minBackoff * Math.pow(2, tagAttempts.count - 1),
            config.maxBackoff
        );

        // Schedule retry
        setTimeout(() => {
            registerForSync(tag);
        }, backoffTime);

        // Notify clients of sync failure
        notifyClients('SYNC_FAILED', {
            tag,
            error: error.message
        });
    }
};

// Reconstruct a request from saved data
const reconstructRequest = async (requestData) => {
    const { url, method, headers, body } = requestData;

    const requestInit = {
        method,
        headers: new Headers(headers),
        // Don't include credentials in reconstructed requests to avoid CORS issues
        mode: 'cors'
    };

    // Add body if present
    if (body && (method === 'POST' || method === 'PUT')) {
        if (typeof body === 'object') {
            requestInit.body = JSON.stringify(body);
        } else {
            requestInit.body = body;
        }
    }

    return new Request(url, requestInit);
};

// Notify all clients of an event
const notifyClients = async (type, data) => {
    const clients = await self.clients.matchAll();

    clients.forEach(client => {
        client.postMessage({
            type,
            ...data
        });
    });
};

// Push notification event
self.addEventListener('push', event => {
    console.log('[Service Worker] Push received:', event);

    let notification = {
        title: 'FSE Lead Collection',
        options: {
            body: 'New notification',
            icon: '/assets/icons/icon-192x192.png',
            badge: '/assets/icons/icon-72x72.png'
        }
    };

    if (event.data) {
        try {
            const data = event.data.json();
            notification = {
                title: data.title || notification.title,
                options: {
                    ...notification.options,
                    body: data.body || notification.options.body,
                    tag: data.tag,
                    data: data.data || {}
                }
            };
        } catch (e) {
            console.error('[Service Worker] Error parsing push data:', e);
        }
    }

    event.waitUntil(
        self.registration.showNotification(notification.title, notification.options)
    );
});

// Notification click event
self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] Notification click:', event);

    event.notification.close();

    let url = '/';

    // If notification has custom data with a URL, use that
    if (event.notification.data && event.notification.data.url) {
        url = event.notification.data.url;
    }

    event.waitUntil(
        // Focus on existing window or open a new one
        self.clients.matchAll({ type: 'window' }).then(clients => {
            // Check if already open
            const client = clients.find(c =>
                c.url.includes(url) && 'focus' in c
            );

            if (client) {
                return client.focus();
            }

            return self.clients.openWindow(url);
        })
    );
});

// Message from clients
self.addEventListener('message', event => {
    console.log('[Service Worker] Message received:', event.data);

    if (!event.data) return;

    const { type, tag } = event.data;

    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;

        case 'TRIGGER_SYNC':
            if (tag && tag.startsWith('sync-')) {
                registerForSync(tag);
            }
            break;

        case 'NETWORK_STATUS':
            // If coming back online, trigger syncs
            if (event.data.isOnline) {
                Object.keys(SYNC_CONFIG).forEach(tag => {
                    registerForSync(tag);
                });
            }
            break;
    }
});

// Service worker installation notification
const sendInstallationMessage = async () => {
    const clients = await self.clients.matchAll();

    clients.forEach(client => {
        client.postMessage({
            type: 'SW_INSTALLED',
            version: CACHE_VERSION
        });
    });
};

// Send installation message after activation
self.addEventListener('activate', event => {
    event.waitUntil(sendInstallationMessage());
});
import syncManager from './syncManager';

/**
 * Register the service worker for PWA functionality
 */
export const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js', {
                scope: '/'
            });

            // Handle service worker updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New service worker available, show update prompt
                        showUpdatePrompt();
                    }
                });
            });

            // Handle controller change (happens when a new service worker takes over)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('Service worker controller changed');
            });

            // Initialize background sync if available
            if ('SyncManager' in window) {
                registration.sync.register('sync-forms');
            }

            console.log('Service worker registered successfully');
            return registration;
        } catch (error) {
            console.error('Service worker registration failed:', error);
        }
    } else {
        console.warn('Service workers are not supported in this browser');
    }

    return null;
};

/**
 * Check if the app is installed (in standalone mode)
 */
export const isAppInstalled = () => {
    return window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
};

/**
 * Show a prompt to the user to update the app when a new version is available
 */
const showUpdatePrompt = () => {
    // Create update notification element
    const updatePrompt = document.createElement('div');
    updatePrompt.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white p-4 rounded-lg shadow-lg border border-blue-200 z-50';
    updatePrompt.innerHTML = `
    <div class="flex items-start">
      <div class="flex-1">
        <h3 class="font-medium text-gray-900">Update available</h3>
        <p class="text-sm text-gray-600 mt-1">A new version of the app is available. Update now for the latest features and improvements.</p>
        <div class="mt-3 flex items-center space-x-2">
          <button id="update-now" class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
            Update Now
          </button>
          <button id="update-later" class="px-3 py-1.5 text-gray-600 text-sm hover:text-gray-900 focus:outline-none">
            Later
          </button>
        </div>
      </div>
      <button id="update-dismiss" class="ml-4 text-gray-400 hover:text-gray-500">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>
  `;

    // Add the prompt to the DOM
    document.body.appendChild(updatePrompt);

    // Handle update now button
    document.getElementById('update-now').addEventListener('click', () => {
        // Skip waiting and reload to activate the new service worker
        navigator.serviceWorker.getRegistration().then(registration => {
            if (registration && registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            window.location.reload();
        });
        updatePrompt.remove();
    });

    // Handle update later button
    document.getElementById('update-later').addEventListener('click', () => {
        updatePrompt.remove();
    });

    // Handle dismiss button
    document.getElementById('update-dismiss').addEventListener('click', () => {
        updatePrompt.remove();
    });
};

/**
 * Request permission for push notifications
 */
export const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
        console.warn('This browser does not support notifications');
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission === 'denied') {
        console.warn('Notification permission was previously denied');
        return false;
    }

    try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        return false;
    }
};

/**
 * Check if the app can be installed (has a beforeinstallprompt event)
 */
export const checkInstallability = () => {
    return new Promise(resolve => {
        window.addEventListener('beforeinstallprompt', event => {
            event.preventDefault();
            resolve(event);
        });

        // If already installed or not installable, resolve with null
        setTimeout(() => resolve(null), 500);
    });
};

/**
 * Initialize the offline capability by setting up listeners and handlers
 */
export const initOfflineCapability = () => {
    // Initialize the sync manager
    syncManager.init();

    // Update offline indicator based on navigator.onLine
    const updateOfflineIndicator = () => {
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            if (navigator.onLine) {
                indicator.classList.add('hidden');
            } else {
                indicator.classList.remove('hidden');
            }
        }
    };

    // Listen for online/offline events
    window.addEventListener('online', () => {
        updateOfflineIndicator();
        syncManager.scheduleSync();
    });

    window.addEventListener('offline', () => {
        updateOfflineIndicator();
    });

    // Initial check
    updateOfflineIndicator();
};
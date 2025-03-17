
import formDataService from './formDataService';
import mediaUploadServices from './mediaUploadServices';
/**
 * Service for handling synchronization of offline data
 */
class SyncService {
    constructor() {
        this.isSyncing = false;
        this.listeners = [];
        this.lastSyncTime = null;
        this.pendingSync = false;
    }

    /**
     * Initialize the sync service
     */
    init() {
        // Listen for online events to trigger sync
        window.addEventListener('online', this.handleOnline.bind(this));

        // Register with service worker if available
        this.registerWithServiceWorker();

        // Set up message listener for sync messages from service worker
        this.setupMessageListener();

        // If we're online at startup, schedule an initial sync
        if (navigator.onLine) {
            this.scheduleSync();
        }
    }

    /**
     * Register with the service worker for background sync
     */
    async registerWithServiceWorker() {
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            try {
                const registration = await navigator.serviceWorker.ready;

                // Register for background sync
                await registration.sync.register('form-sync');
                await registration.sync.register('media-upload-sync');

                console.log('Registered for background sync');
            } catch (error) {
                console.error('Failed to register for background sync:', error);
            }
        }
    }

    /**
     * Set up message listener for service worker messages
     */
    setupMessageListener() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data) {
                    switch (event.data.type) {
                        case 'SYNC_FORMS':
                            this.syncForms()
                                .then(() => {
                                    this.notifyServiceWorker('SYNC_FORMS_COMPLETE');
                                })
                                .catch(error => {
                                    console.error('Error syncing forms:', error);
                                    this.notifyServiceWorker('SYNC_FORMS_ERROR', { error: error.message });
                                });
                            break;

                        case 'SYNC_MEDIA':
                            this.syncMedia()
                                .then(() => {
                                    this.notifyServiceWorker('SYNC_MEDIA_COMPLETE');
                                })
                                .catch(error => {
                                    console.error('Error syncing media:', error);
                                    this.notifyServiceWorker('SYNC_MEDIA_ERROR', { error: error.message });
                                });
                            break;

                        case 'SYNC_COMPLETED':
                            this.notifyListeners('syncCompleted', event.data);
                            break;

                        case 'SYNC_FAILED':
                            this.notifyListeners('syncFailed', event.data);
                            break;
                    }
                }
            });
        }
    }

    /**
     * Send a message to the service worker
     * @param {string} type - The message type
     * @param {Object} data - Additional data to send
     */
    notifyServiceWorker(type, data = {}) {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type,
                ...data
            });
        }
    }

    /**
     * Handle online event
     */
    handleOnline() {
        console.log('Device is online, scheduling sync');
        this.scheduleSync();
    }

    /**
     * Schedule a sync operation with debouncing
     */
    scheduleSync() {
        // Mark that we have a pending sync
        this.pendingSync = true;

        // Clear any existing timeout
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
        }

        // Schedule a new sync with a slight delay to avoid multiple syncs
        this.syncTimeout = setTimeout(() => {
            this.syncAll();
        }, 2000);
    }

    /**
     * Trigger an immediate sync
     */
    triggerSync() {
        if (this.isSyncing) {
            // If already syncing, just mark as pending
            this.pendingSync = true;
            return Promise.resolve();
        }

        return this.syncAll();
    }

    /**
     * Sync all pending items
     */
    async syncAll() {
        // Prevent multiple simultaneous syncs
        if (this.isSyncing) {
            return;
        }

        this.isSyncing = true;
        this.pendingSync = false;
        this.notifyListeners('syncStarted');

        try {
            // First check if we're online
            if (!navigator.onLine) {
                this.notifyListeners('syncFailed', { error: 'Device is offline' });
                this.isSyncing = false;
                return;
            }

            // Sync forms first
            const formResults = await this.syncForms();

            // Then sync media
            const mediaResults = await this.syncMedia();

            this.lastSyncTime = new Date().toISOString();

            this.notifyListeners('syncCompleted', {
                formResults,
                mediaResults,
                timestamp: this.lastSyncTime
            });
        } catch (error) {
            console.error('Sync failed:', error);
            this.notifyListeners('syncFailed', { error: error.message });
        } finally {
            this.isSyncing = false;

            // If another sync was requested while we were syncing, schedule it
            if (this.pendingSync) {
                this.scheduleSync();
            }
        }
    }

    /**
     * Sync form submissions
     */
    async syncForms() {
        try {
            // Get pending form submissions
            const pendingSubmissions = await formDataService.getPendingSubmissions();

            if (!pendingSubmissions || pendingSubmissions.length === 0) {
                return { submitted: 0, failed: 0 };
            }

            console.log(`Found ${pendingSubmissions.length} pending form submissions to sync`);

            let submitted = 0;
            let failed = 0;

            // Process each submission
            for (const submission of pendingSubmissions) {
                try {
                    // Submit to server
                    await formDataService.submitToServer(submission.id);
                    submitted++;
                } catch (error) {
                    console.error(`Error submitting form ${submission.id}:`, error);
                    failed++;

                    // Update retry count
                    await formDataService.updateSubmissionRetry(submission.id);
                }
            }

            return { submitted, failed };
        } catch (error) {
            console.error('Error syncing forms:', error);
            throw error;
        }
    }

    /**
     * Sync media uploads
     */
    async syncMedia() {
        try {
            // Process the upload queue
            const results = await mediaUploadServices.processUploadQueue('/api');

            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            return { uploaded: successful, failed };
        } catch (error) {
            console.error('Error syncing media:', error);
            throw error;
        }
    }

    /**
     * Add a sync event listener
     * @param {Function} listener - The listener function to call on sync events
     */
    addListener(listener) {
        if (typeof listener === 'function' && !this.listeners.includes(listener)) {
            this.listeners.push(listener);
        }
        return () => this.removeListener(listener);
    }

    /**
     * Remove a sync event listener
     * @param {Function} listener - The listener function to remove
     */
    removeListener(listener) {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    /**
     * Notify all listeners of a sync event
     * @param {string} event - The event name
     * @param {Object} data - Event data
     */
    notifyListeners(event, data = {}) {
        this.listeners.forEach(listener => {
            try {
                listener(event, data);
            } catch (error) {
                console.error('Error in sync listener:', error);
            }
        });
    }

    /**
     * Get current sync status
     */
    getSyncStatus() {
        return {
            isSyncing: this.isSyncing,
            isOnline: navigator.onLine,
            lastSyncTime: this.lastSyncTime,
            pendingSync: this.pendingSync
        };
    }
}

// Create and export a singleton instance
const syncService = new SyncService();
export default syncService;
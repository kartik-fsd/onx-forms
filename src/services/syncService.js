import { SyncQueueDAO } from '../db';
import { checkApiConnection } from '../api/ApiService.js';

class SyncService {
    constructor() {
        this.isSyncing = false;
        this.syncPromise = null;
        this.listeners = [];
        this.maxRetryAttempts = 5;
        this.syncInterval = null;
        this.lastSyncTime = null;
    }

    init() {
        // Listen for online events
        window.addEventListener('online', this.handleOnline.bind(this));

        // Set up periodic sync when online
        this.setupPeriodicSync();

        // Register with service worker
        this.registerWithServiceWorker();

        // Check if we're online at startup
        if (navigator.onLine) {
            this.scheduleSync(3000); // Schedule sync with a 3-second delay
        }
    }

    setupPeriodicSync(interval = 5 * 60 * 1000) { // Default 5 minutes
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        this.syncInterval = setInterval(() => {
            if (navigator.onLine && !this.isSyncing) {
                this.syncAll();
            }
        }, interval);
    }

    async registerWithServiceWorker() {
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            try {
                const registration = await navigator.serviceWorker.ready;

                // Register for background sync
                await registration.sync.register('sync-forms');
                await registration.sync.register('sync-media');

                // Listen for messages from service worker
                navigator.serviceWorker.addEventListener('message', (event) => {
                    if (event.data) {
                        switch (event.data.type) {
                            case 'SYNC_REQUESTED':
                                this.scheduleSync();
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
            } catch (error) {
                console.error('Failed to register for background sync:', error);
            }
        }
    }

    handleOnline() {
        this.scheduleSync();
        this.notifyListeners('networkStatusChanged', { isOnline: true });
    }

    scheduleSync(delay = 1000) {
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
        }

        this.syncTimeout = setTimeout(() => {
            this.syncAll();
        }, delay);
    }

    async addToQueue(type, data, priority = 'normal') {
        // Add timestamp and priority field
        await SyncQueueDAO.addToQueue({
            type,
            data,
            status: 'pending',
            priority, // 'high', 'normal', 'low'
            createdAt: new Date().toISOString(),
            attempts: 0
        });

        // If we're online, schedule a sync
        if (navigator.onLine) {
            this.scheduleSync();
        }
    }

    async syncAll() {
        // Prevent multiple simultaneous syncs
        if (this.isSyncing) {
            return this.syncPromise;
        }

        this.isSyncing = true;
        this.notifyListeners('syncStarted');

        this.syncPromise = (async () => {
            try {
                // First check if we're online and API is reachable
                const isApiReachable = await checkApiConnection();
                if (!isApiReachable) {
                    this.notifyListeners('syncFailed', { error: 'API is not reachable' });
                    return;
                }

                // First process media uploads
                const mediaResults = await this.syncMedia();

                // Then process form submissions
                const formResults = await this.syncForms();

                this.lastSyncTime = new Date().toISOString();

                this.notifyListeners('syncCompleted', {
                    syncedForms: formResults.syncedItems,
                    failedForms: formResults.failedItems,
                    syncedMedia: mediaResults.syncedItems,
                    failedMedia: mediaResults.failedItems,
                    timestamp: this.lastSyncTime
                });
            } catch (error) {
                console.error('Sync failed:', error);
                this.notifyListeners('syncFailed', { error: error.message });
            } finally {
                this.isSyncing = false;
                this.syncPromise = null;
            }
        })();

        return this.syncPromise;
    }

    async processItem(item) {
        // Enhanced with progressive backoff and better error handling
        try {
            // Skip if the item has exceeded max retry attempts
            if (item.attempts >= this.maxRetryAttempts) {
                await SyncQueueDAO.updateStatus(item.id, 'failed', 'Max retry attempts exceeded');
                return { status: 'failed', reason: 'Max retries exceeded' };
            }

            // Update status to processing
            await SyncQueueDAO.updateStatus(item.id, 'processing');

            // Process based on item type
            let result;
            switch (item.type) {
                case 'FORM_SUBMISSION':
                    result = await this.syncFormSubmission(item);
                    break;
                case 'MEDIA_UPLOAD':
                    result = await this.syncMediaUpload(item);
                    break;
                default:
                    throw new Error(`Unknown sync item type: ${item.type}`);
            }

            // Mark as completed
            await SyncQueueDAO.updateStatus(item.id, 'completed');
            return { status: 'completed', result };
        } catch (error) {
            console.error(`Error processing sync item ${item.id}:`, error);

            // Calculate next retry time with exponential backoff
            const attempts = item.attempts + 1;
            const backoffTime = Math.min(1000 * Math.pow(2, attempts), 30 * 60 * 1000); // Max 30 min
            const nextRetry = new Date(Date.now() + backoffTime).toISOString();

            await SyncQueueDAO.updateStatus(
                item.id,
                'error',
                error.message,
                attempts,
                nextRetry
            );

            throw error;
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
const syncManager = new SyncService();
export default syncManager;
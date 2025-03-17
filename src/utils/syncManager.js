import { FormDataDAO, MediaDAO, SyncQueueDAO } from '../db';
import { FormAPI, MediaAPI, isOnline, checkApiConnection } from '../api';

// Number of items to process in each sync batch
const BATCH_SIZE = 10;
// Maximum number of retry attempts per item
const MAX_RETRY_ATTEMPTS = 3;

/**
 * SyncManager handles background synchronization of form submissions
 * and media uploads when the device is online.
 */
class SyncManager {
    constructor() {
        this.isSyncing = false;
        this.syncPromise = null;
        this.listeners = [];
    }

    /**
     * Initialize the sync manager and set up event listeners
     */
    init() {
        // Listen for online events to trigger sync
        window.addEventListener('online', this.handleOnline.bind(this));

        // Register with service worker if available
        this.registerWithServiceWorker();

        // If we're online at startup, schedule an initial sync
        if (isOnline()) {
            this.scheduleSync();
        }
    }

    /**
     * Register sync with service worker
     */
    async registerWithServiceWorker() {
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            try {
                const registration = await navigator.serviceWorker.ready;

                // Register for background sync
                await registration.sync.register('sync-forms');

                // Listen for messages from service worker
                navigator.serviceWorker.addEventListener('message', (event) => {
                    if (event.data && event.data.type === 'SYNC_REQUESTED') {
                        this.scheduleSync();
                    }
                });
            } catch (error) {
                console.error('Failed to register for background sync:', error);
            }
        }
    }

    /**
     * Handle online event
     */
    handleOnline() {
        this.scheduleSync();
    }

    /**
     * Schedule a sync operation with debouncing
     */
    scheduleSync() {
        // Clear any existing timeout
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
        }

        // Schedule a new sync with a slight delay to avoid multiple syncs
        this.syncTimeout = setTimeout(() => {
            this.syncAll();
        }, 1000);
    }

    /**
     * Add an item to the sync queue
     * @param {string} type - Type of item (e.g., 'FORM_SUBMISSION', 'MEDIA_UPLOAD')
     * @param {Object} data - Data to be synchronized
     */
    async addToQueue(type, data) {
        await SyncQueueDAO.addToQueue({
            type,
            data,
            status: 'pending',
            createdAt: new Date().toISOString(),
            attempts: 0
        });

        // If we're online, schedule a sync
        if (isOnline()) {
            this.scheduleSync();
        }
    }

    /**
     * Sync all pending items
     */
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

                // Process pending items in batches
                let hasMoreItems = true;
                let syncedItems = 0;
                let failedItems = 0;

                while (hasMoreItems) {
                    const pendingItems = await SyncQueueDAO.getNextBatch(BATCH_SIZE);

                    if (!pendingItems || pendingItems.length === 0) {
                        hasMoreItems = false;
                        break;
                    }

                    // Process each item in the batch
                    const results = await Promise.allSettled(
                        pendingItems.map(item => this.processItem(item))
                    );

                    // Count successes and failures
                    results.forEach(result => {
                        if (result.status === 'fulfilled') {
                            syncedItems++;
                        } else {
                            failedItems++;
                        }
                    });
                }

                this.notifyListeners('syncCompleted', { syncedItems, failedItems });
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

    /**
     * Process a single sync queue item
     * @param {Object} item - The sync queue item to process
     */
    async processItem(item) {
        try {
            // Skip if the item has exceeded max retry attempts
            if (item.attempts >= MAX_RETRY_ATTEMPTS) {
                await SyncQueueDAO.updateStatus(item.id, 'failed', 'Max retry attempts exceeded');
                return;
            }

            // Update status to processing
            await SyncQueueDAO.updateStatus(item.id, 'processing');

            // Process based on item type
            switch (item.type) {
                case 'FORM_SUBMISSION':
                    await this.syncFormSubmission(item);
                    break;
                case 'MEDIA_UPLOAD':
                    await this.syncMediaUpload(item);
                    break;
                default:
                    throw new Error(`Unknown sync item type: ${item.type}`);
            }

            // Mark as completed
            await SyncQueueDAO.updateStatus(item.id, 'completed');
        } catch (error) {
            console.error(`Error processing sync item ${item.id}:`, error);
            await SyncQueueDAO.updateStatus(item.id, 'error', error.message);
            throw error;
        }
    }

    /**
     * Sync a form submission
     * @param {Object} item - The sync queue item
     */
    async syncFormSubmission(item) {
        const { formDataId } = item.data;

        // Get the form data from IndexedDB
        const formData = await FormDataDAO.getFormData(formDataId);
        if (!formData) {
            throw new Error(`Form data not found for ID: ${formDataId}`);
        }

        // Get associated media files
        const mediaFiles = await MediaDAO.getMediaByFormData(formDataId);

        // First, make sure all media is uploaded
        for (const media of mediaFiles) {
            if (!media.serverUrl) {
                // Add to sync queue if not already uploaded
                await this.addToQueue('MEDIA_UPLOAD', { mediaId: media.id, formDataId });
                throw new Error('Media files must be uploaded before form submission');
            }
        }

        // Submit the form data to the server
        const response = await FormAPI.submitForm({
            formId: formData.formId,
            projectId: formData.projectId,
            data: formData.data,
            mediaReferences: mediaFiles.map(media => ({
                fieldName: media.fieldName,
                serverUrl: media.serverUrl
            })),
            createdAt: formData.createdAt
        });

        // Update the form data status in IndexedDB
        await FormDataDAO.markAsSubmitted(formDataId);

        return response;
    }

    /**
     * Sync a media upload
     * @param {Object} item - The sync queue item
     */
    async syncMediaUpload(item) {
        const { mediaId } = item.data;

        // Get the media file from IndexedDB
        const media = await MediaDAO.getMedia(mediaId);
        if (!media) {
            throw new Error(`Media not found for ID: ${mediaId}`);
        }

        // If already uploaded, skip
        if (media.serverUrl) {
            return { id: mediaId, serverUrl: media.serverUrl };
        }

        // Upload the media file to the server
        const response = await MediaAPI.uploadMedia(media.data, {
            fieldName: media.fieldName,
            formDataId: media.formDataId,
            type: media.type
        });

        // Update the media record with the server URL
        await MediaDAO.updateMedia(mediaId, {
            serverUrl: response.url,
            uploadedAt: new Date().toISOString()
        });

        return response;
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
            isOnline: isOnline()
        };
    }
}

// Create and export a singleton instance
const syncManager = new SyncManager();
export default syncManager;
import { openDB } from 'idb';
import { v4 as uuidv4 } from 'uuid';

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const DB_NAME = 'media-uploads';
const MEDIA_STORE = 'media';
const CHUNKS_STORE = 'chunks';
const UPLOAD_QUEUE_STORE = 'upload-queue';

// Initialize the IndexedDB for media storage
async function initializeDB() {
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            // Store for media metadata
            if (!db.objectStoreNames.contains(MEDIA_STORE)) {
                const mediaStore = db.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
                mediaStore.createIndex('formDataId', 'formDataId', { unique: false });
                mediaStore.createIndex('status', 'status', { unique: false });
            }

            // Store for chunked media data
            if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
                const chunksStore = db.createObjectStore(CHUNKS_STORE, { keyPath: 'id' });
                chunksStore.createIndex('mediaId', 'mediaId', { unique: false });
                chunksStore.createIndex('chunkIndex', 'chunkIndex', { unique: false });
            }

            // Store for upload queue
            if (!db.objectStoreNames.contains(UPLOAD_QUEUE_STORE)) {
                const queueStore = db.createObjectStore(UPLOAD_QUEUE_STORE, { keyPath: 'id' });
                queueStore.createIndex('status', 'status', { unique: false });
                queueStore.createIndex('timestamp', 'timestamp', { unique: false });
                queueStore.createIndex('retryCount', 'retryCount', { unique: false });
            }
        }
    });
}

// Compress an image before storing
async function compressImage(file, options = {}) {
    const { maxWidth = 1200, maxHeight = 1200, quality = 0.8 } = options;

    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = function (e) {
            img.src = e.target.result;
        };

        img.onload = function () {
            // Calculate new dimensions
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }

            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }

            // Create canvas and draw image
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to Blob
            canvas.toBlob(
                (blob) => {
                    resolve(new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: file.lastModified
                    }));
                },
                'image/jpeg',
                quality
            );
        };

        img.onerror = reject;

        reader.readAsDataURL(file);
    });
}

// Split file into chunks and store in IndexedDB
async function storeMedia(file, formDataId, fieldName) {
    try {
        const db = await initializeDB();

        // Generate a unique ID for this media
        const mediaId = uuidv4();

        // Determine if we need to compress
        let processedFile = file;
        if (file.type.startsWith('image/') && file.type !== 'image/gif') {
            processedFile = await compressImage(file);
        }

        // Store media metadata
        await db.add(MEDIA_STORE, {
            id: mediaId,
            formDataId,
            fieldName,
            filename: processedFile.name,
            type: processedFile.type,
            size: processedFile.size,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        // Split file into chunks and store
        const totalChunks = Math.ceil(processedFile.size / CHUNK_SIZE);

        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, processedFile.size);
            const chunk = processedFile.slice(start, end);

            await db.add(CHUNKS_STORE, {
                id: `${mediaId}_${i}`,
                mediaId,
                chunkIndex: i,
                data: chunk,
                size: chunk.size
            });
        }

        // Add to upload queue
        await db.add(UPLOAD_QUEUE_STORE, {
            id: mediaId,
            mediaId,
            status: 'pending',
            timestamp: new Date().toISOString(),
            retryCount: 0,
            totalChunks
        });

        // Trigger upload if online
        if (navigator.onLine) {
            triggerBackgroundSync();
        }

        return {
            mediaId,
            status: 'stored',
            size: processedFile.size
        };
    } catch (error) {
        console.error('Error storing media:', error);
        throw error;
    }
}

// Retrieve a complete file from chunks
async function getMediaFile(mediaId) {
    try {
        const db = await initializeDB();

        // Get metadata
        const metadata = await db.get(MEDIA_STORE, mediaId);
        if (!metadata) {
            throw new Error(`Media with ID ${mediaId} not found`);
        }

        // Get all chunks
        const chunks = await db.getAllFromIndex(CHUNKS_STORE, 'mediaId', mediaId);

        // Sort chunks by index
        chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

        // Combine chunks into a single blob
        const chunksData = chunks.map(chunk => chunk.data);

        return {
            metadata,
            file: new File(chunksData, metadata.filename, { type: metadata.type })
        };
    } catch (error) {
        console.error('Error retrieving media:', error);
        throw error;
    }
}

// Try to upload a media file
async function uploadMedia(mediaId, apiUrl) {
    try {
        const db = await initializeDB();

        // Get metadata and upload entry
        const metadata = await db.get(MEDIA_STORE, mediaId);
        const uploadEntry = await db.get(UPLOAD_QUEUE_STORE, mediaId);

        if (!metadata || !uploadEntry) {
            throw new Error(`Media or upload entry with ID ${mediaId} not found`);
        }

        // Update status
        await db.put(MEDIA_STORE, {
            ...metadata,
            status: 'uploading',
            updatedAt: new Date().toISOString()
        });

        await db.put(UPLOAD_QUEUE_STORE, {
            ...uploadEntry,
            status: 'uploading',
            timestamp: new Date().toISOString()
        });

        // Get total chunks
        const totalChunks = uploadEntry.totalChunks;

        // Upload each chunk
        for (let i = 0; i < totalChunks; i++) {
            const chunkId = `${mediaId}_${i}`;
            const chunk = await db.get(CHUNKS_STORE, chunkId);

            if (!chunk) {
                throw new Error(`Chunk ${chunkId} not found`);
            }

            // Create form data for this chunk
            const formData = new FormData();
            formData.append('mediaId', mediaId);
            formData.append('chunkIndex', i.toString());
            formData.append('totalChunks', totalChunks.toString());
            formData.append('fieldName', metadata.fieldName);
            formData.append('formDataId', metadata.formDataId);
            formData.append('filename', metadata.filename);
            formData.append('type', metadata.type);
            formData.append('chunk', chunk.data);

            // Upload chunk
            const response = await fetch(`${apiUrl}/api/media/chunk`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Failed to upload chunk ${i}: ${response.statusText}`);
            }
        }

        // Mark as complete
        await db.put(MEDIA_STORE, {
            ...metadata,
            status: 'uploaded',
            updatedAt: new Date().toISOString()
        });

        await db.put(UPLOAD_QUEUE_STORE, {
            ...uploadEntry,
            status: 'completed',
            timestamp: new Date().toISOString()
        });

        return {
            mediaId,
            status: 'uploaded'
        };
    } catch (error) {
        console.error(`Error uploading media ${mediaId}:`, error);

        // Update with error
        const db = await initializeDB();
        const metadata = await db.get(MEDIA_STORE, mediaId);
        const uploadEntry = await db.get(UPLOAD_QUEUE_STORE, mediaId);

        if (metadata) {
            await db.put(MEDIA_STORE, {
                ...metadata,
                status: 'error',
                error: error.message,
                updatedAt: new Date().toISOString()
            });
        }

        if (uploadEntry) {
            const retryCount = uploadEntry.retryCount + 1;
            await db.put(UPLOAD_QUEUE_STORE, {
                ...uploadEntry,
                status: retryCount >= 5 ? 'failed' : 'pending',
                error: error.message,
                retryCount,
                timestamp: new Date().toISOString(),
                // Exponential backoff for retries
                nextRetry: new Date(Date.now() + (Math.pow(2, retryCount) * 30000)).toISOString()
            });
        }

        throw error;
    }
}

// Process the upload queue
async function processUploadQueue(apiUrl) {
    const db = await initializeDB();

    // Get pending uploads
    const now = new Date().toISOString();
    const pendingUploads = await db.getAllFromIndex(
        UPLOAD_QUEUE_STORE,
        'status',
        'pending'
    ).then(items =>
        items.filter(item => !item.nextRetry || item.nextRetry <= now)
    );

    // Process each upload
    const results = await Promise.allSettled(
        pendingUploads.map(item => uploadMedia(item.mediaId, apiUrl))
    );

    return results;
}

// Trigger sync via the service worker if available
function triggerBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
            registration.sync.register('media-upload-sync');
        }).catch(err => {
            console.error('Error registering for sync:', err);
            // Fall back to immediate processing
            processUploadQueue('/');
        });
    } else {
        // No ServiceWorker/SyncManager support, process immediately
        processUploadQueue('/');
    }
}

// Start synchronization when online
function initMediaSync(apiUrl) {
    window.addEventListener('online', () => {
        processUploadQueue(apiUrl);
    });

    // Process queue when first initialized if online
    if (navigator.onLine) {
        processUploadQueue(apiUrl);
    }
}

export default {
    storeMedia,
    getMediaFile,
    uploadMedia,
    processUploadQueue,
    initMediaSync,
    compressImage
};
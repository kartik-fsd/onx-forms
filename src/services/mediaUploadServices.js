import { MediaDAO } from '../db';
import { v4 as uuidv4 } from 'uuid';

class MediaUploadService {
    constructor() {
        this.chunkSize = 1024 * 1024; // 1MB chunks
        this.maxRetries = 3;
        this.uploadQueue = [];
        this.isUploading = false;
        this.listeners = [];
        this.compressionOptions = {
            image: {
                maxWidth: 1600,
                maxHeight: 1200,
                quality: 0.8
            },
            video: {
                maxWidth: 1280,
                maxHeight: 720,
                bitrate: 1000000 // 1Mbps
            }
        };
    }

    /**
     * Initialize the media service
     */
    init() {
        // Listen for online events to resume uploads
        window.addEventListener('online', this.handleOnline.bind(this));

        // Process queue if online at startup
        if (navigator.onLine) {
            this.processUploadQueue();
        }
    }

    /**
     * Handle online event
     */
    handleOnline() {
        this.processUploadQueue();
    }

    /**
     * Compress image file to reduce size
     * @param {File|Blob} file - The image file to compress
     * @returns {Promise<Blob>} Compressed image file
     */
    async compressImage(file) {
        const { maxWidth, maxHeight, quality } = this.compressionOptions.image;

        return new Promise((resolve, reject) => {
            // Create file reader
            const reader = new FileReader();
            reader.readAsDataURL(file);

            reader.onload = (event) => {
                // Create image element
                const img = new Image();
                img.src = event.target.result;

                img.onload = () => {
                    // Determine new dimensions
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = Math.round(height * (maxWidth / width));
                        width = maxWidth;
                    }

                    if (height > maxHeight) {
                        width = Math.round(width * (maxHeight / height));
                        height = maxHeight;
                    }

                    // Create canvas for compression
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;

                    // Draw image to canvas
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to blob
                    canvas.toBlob(
                        (blob) => resolve(blob),
                        file.type,
                        quality
                    );
                };

                img.onerror = () => {
                    reject(new Error('Failed to load image for compression'));
                };
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file for compression'));
            };
        });
    }

    /**
     * Save media file to storage and queue for upload
     * @param {Object} mediaData - Media data object
     * @returns {Promise<Object>} Media reference
     */
    async saveMedia(mediaData) {
        try {
            const { fieldName, type, data, formDataId } = mediaData;

            // Generate unique ID
            const mediaId = uuidv4();

            // Compress if it's an image
            let processedData = data;
            let size = data.size;

            if (type.startsWith('image/') && type !== 'image/gif') {
                try {
                    processedData = await this.compressImage(data);
                    size = processedData.size;
                } catch (error) {
                    console.warn('Image compression failed, using original:', error);
                }
            }

            // Split into chunks for large files
            const chunks = [];
            let offset = 0;

            while (offset < size) {
                const chunk = processedData.slice(offset, offset + this.chunkSize);
                chunks.push({
                    id: `${mediaId}_${chunks.length}`,
                    index: chunks.length,
                    data: chunk,
                    size: chunk.size
                });
                offset += this.chunkSize;
            }

            // Store media metadata
            const mediaRecord = {
                id: mediaId,
                fieldName,
                type,
                size,
                formDataId,
                filename: data.name || `${fieldName}_${Date.now()}.${type.split('/')[1]}`,
                chunks: chunks.length,
                uploaded: 0,
                status: 'pending',
                createdAt: new Date().toISOString(),
                uploadedAt: null,
                serverUrl: null,
                retryCount: 0,
                lastError: null
            };

            // Save media record
            await MediaDAO.saveMedia(mediaRecord);

            // Save chunks
            for (const chunk of chunks) {
                await this.saveChunk(mediaId, chunk);
            }

            // Add to upload queue
            this.addToUploadQueue(mediaId);

            // Return reference
            return {
                mediaId,
                fieldName,
                type,
                size,
                status: 'queued'
            };
        } catch (error) {
            console.error('Error saving media:', error);
            throw error;
        }
    }

    /**
     * Save a media chunk to storage
     * @param {string} mediaId - Media ID
     * @param {Object} chunk - Chunk object
     */
    async saveChunk(mediaId, chunk) {
        // In a production implementation, this would save to IndexedDB
        // For simplicity, we'll just store in memory in this example
        this.chunks = this.chunks || {};
        this.chunks[chunk.id] = chunk;
    }

    /**
     * Add media to upload queue
     * @param {string} mediaId - Media ID
     */
    addToUploadQueue(mediaId) {
        this.uploadQueue.push(mediaId);

        // Start processing if online
        if (navigator.onLine && !this.isUploading) {
            this.processUploadQueue();
        }
    }

    /**
     * Process the upload queue
     */
    async processUploadQueue() {
        if (this.isUploading || this.uploadQueue.length === 0 || !navigator.onLine) {
            return;
        }

        this.isUploading = true;

        try {
            while (this.uploadQueue.length > 0) {
                const mediaId = this.uploadQueue[0];

                try {
                    const media = await MediaDAO.getMedia(mediaId);

                    if (!media) {
                        this.uploadQueue.shift(); // Remove from queue
                        continue;
                    }

                    // Skip already uploaded media
                    if (media.status === 'completed') {
                        this.uploadQueue.shift();
                        continue;
                    }

                    // Upload media
                    await this.uploadMedia(media);

                    // Remove from queue if successful
                    this.uploadQueue.shift();
                } catch (error) {
                    console.error(`Error uploading media ${mediaId}:`, error);

                    // Get media again to update retry count
                    const media = await MediaDAO.getMedia(mediaId);

                    if (media) {
                        // Update retry count
                        const retryCount = (media.retryCount || 0) + 1;

                        if (retryCount >= this.maxRetries) {
                            // Max retries reached, mark as failed
                            await MediaDAO.updateMedia(mediaId, {
                                status: 'failed',
                                lastError: error.message,
                                retryCount
                            });

                            // Remove from queue
                            this.uploadQueue.shift();
                        } else {
                            // Update retry count and move to end of queue
                            await MediaDAO.updateMedia(mediaId, {
                                status: 'pending',
                                lastError: error.message,
                                retryCount
                            });

                            // Move to end of queue for later retry
                            this.uploadQueue.shift();
                            this.uploadQueue.push(mediaId);

                            // Break to allow other uploads to proceed
                            break;
                        }
                    } else {
                        // Media not found, remove from queue
                        this.uploadQueue.shift();
                    }
                }
            }
        } finally {
            this.isUploading = false;
        }
    }

    /**
     * Upload media to the server using chunked upload
     * @param {Object} media - Media object
     */
    async uploadMedia(media) {
        // Update status to uploading
        await MediaDAO.updateMedia(media.id, { status: 'uploading' });

        // Notify progress start
        this.notifyProgress(media.id, 0, media.chunks);

        // Upload each chunk
        for (let i = 0; i < media.chunks; i++) {
            const chunkId = `${media.id}_${i}`;
            const chunk = this.chunks[chunkId];

            if (!chunk) {
                throw new Error(`Chunk ${chunkId} not found`);
            }

            // Create form data
            const formData = new FormData();
            formData.append('mediaId', media.id);
            formData.append('chunkIndex', i.toString());
            formData.append('totalChunks', media.chunks.toString());
            formData.append('filename', media.filename);
            formData.append('fieldName', media.fieldName);
            formData.append('type', media.type);
            formData.append('chunk', new Blob([chunk.data], { type: 'application/octet-stream' }));

            // Upload chunk with retry logic
            let attempts = 0;
            let success = false;

            while (attempts < 3 && !success) {
                try {
                    const response = await fetch('/api/media/chunk', {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) {
                        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                    }

                    success = true;
                } catch (error) {
                    attempts++;

                    if (attempts >= 3) {
                        throw error;
                    }

                    // Wait before retry (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempts)));
                }
            }

            // Update progress
            await MediaDAO.updateMedia(media.id, { uploaded: i + 1 });
            this.notifyProgress(media.id, i + 1, media.chunks);
        }

        // Complete upload by notifying server
        const completeResponse = await fetch('/api/media/complete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mediaId: media.id,
                filename: media.filename,
                type: media.type,
                chunks: media.chunks,
                size: media.size,
                fieldName: media.fieldName
            })
        });

        if (!completeResponse.ok) {
            throw new Error(`Failed to complete upload: ${completeResponse.statusText}`);
        }

        const result = await completeResponse.json();

        // Update media record with server URL
        await MediaDAO.updateMedia(media.id, {
            status: 'completed',
            serverUrl: result.url,
            uploadedAt: new Date().toISOString()
        });

        // Notify completion
        this.notifyCompletion(media.id, result.url);

        return result;
    }

    /**
     * Add a progress listener
     * @param {Function} listener - Progress listener function
     */
    addListener(listener) {
        if (typeof listener === 'function' && !this.listeners.includes(listener)) {
            this.listeners.push(listener);
        }
        return () => this.removeListener(listener);
    }

    /**
     * Remove a progress listener
     * @param {Function} listener - Progress listener function
     */
    removeListener(listener) {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    /**
     * Notify progress to all listeners
     * @param {string} mediaId - Media ID
     * @param {number} uploaded - Number of chunks uploaded
     * @param {number} total - Total number of chunks
     */
    notifyProgress(mediaId, uploaded, total) {
        const percentage = total === 0 ? 0 : Math.round((uploaded / total) * 100);

        this.listeners.forEach(listener => {
            try {
                listener({
                    type: 'progress',
                    mediaId,
                    uploaded,
                    total,
                    percentage
                });
            } catch (error) {
                console.error('Error in media upload listener:', error);
            }
        });
    }

    /**
     * Notify completion to all listeners
     * @param {string} mediaId - Media ID
     * @param {string} url - Server URL for the uploaded media
     */
    notifyCompletion(mediaId, url) {
        this.listeners.forEach(listener => {
            try {
                listener({
                    type: 'complete',
                    mediaId,
                    url
                });
            } catch (error) {
                console.error('Error in media upload listener:', error);
            }
        });
    }

    /**
     * Get upload progress for a media
     * @param {string} mediaId - Media ID
     * @returns {Promise<Object>} Upload progress
     */
    async getUploadProgress(mediaId) {
        const media = await MediaDAO.getMedia(mediaId);

        if (!media) {
            return { mediaId, status: 'not_found' };
        }

        return {
            mediaId,
            status: media.status,
            uploaded: media.uploaded || 0,
            total: media.chunks || 0,
            percentage: media.chunks === 0 ? 0 : Math.round((media.uploaded / media.chunks) * 100),
            serverUrl: media.serverUrl,
            error: media.lastError
        };
    }
}

// Create and export singleton instance
const mediaUploadService = new MediaUploadService();
export default mediaUploadService;
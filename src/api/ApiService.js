/**
 * Enhanced API service with improved error handling, retry logic,
 * and request optimization for the FSE Lead Collection System
 */
class EnhancedApiService {
    constructor(baseUrl = '/api') {
        this.baseUrl = baseUrl;
        this.defaultTimeout = 30000; // 30 seconds
        this.maxRetries = 3;
        this.tokenRefreshPromise = null;
        this.accessToken = null;
        this.refreshToken = null;

        // Load tokens from localStorage if available
        this.loadTokens();
    }

    /**
     * Load authentication tokens from storage
     */
    loadTokens() {
        try {
            this.accessToken = localStorage.getItem('access_token');
            this.refreshToken = localStorage.getItem('refresh_token');
        } catch (error) {
            console.warn('Failed to load auth tokens:', error);
        }
    }

    /**
     * Save authentication tokens to storage
     * @param {string} accessToken - JWT access token
     * @param {string} refreshToken - JWT refresh token
     */
    saveTokens(accessToken, refreshToken) {
        try {
            if (accessToken) {
                localStorage.setItem('access_token', accessToken);
                this.accessToken = accessToken;
            }

            if (refreshToken) {
                localStorage.setItem('refresh_token', refreshToken);
                this.refreshToken = refreshToken;
            }
        } catch (error) {
            console.warn('Failed to save auth tokens:', error);
        }
    }

    /**
     * Clear authentication tokens
     */
    clearTokens() {
        try {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            this.accessToken = null;
            this.refreshToken = null;
        } catch (error) {
            console.warn('Failed to clear auth tokens:', error);
        }
    }

    /**
     * Refresh the access token using the refresh token
     * @returns {Promise<string>} New access token
     */
    async refreshAccessToken() {
        // Ensure we only make one refresh request at a time
        if (this.tokenRefreshPromise) {
            return this.tokenRefreshPromise;
        }

        this.tokenRefreshPromise = (async () => {
            try {
                if (!this.refreshToken) {
                    throw new Error('No refresh token available');
                }

                const response = await fetch(`${this.baseUrl}/auth/refresh`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        refreshToken: this.refreshToken
                    })
                });

                if (!response.ok) {
                    // If refresh fails, clear tokens and require re-login
                    this.clearTokens();
                    throw new Error(`Token refresh failed: ${response.status}`);
                }

                const data = await response.json();

                // Save new tokens
                this.saveTokens(data.accessToken, data.refreshToken);

                return data.accessToken;
            } finally {
                this.tokenRefreshPromise = null;
            }
        })();

        return this.tokenRefreshPromise;
    }

    /**
     * Makes an HTTP request with automatic retries and authentication
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Request options
     * @returns {Promise<Object>} Response data
     */
    async request(endpoint, options = {}) {
        const {
            method = 'GET',
            body,
            headers = {},
            requireAuth = true,
            timeout = this.defaultTimeout,
            retries = this.maxRetries,
            signal,
        } = options;

        // Prepare URL and headers
        const url = endpoint.startsWith('http')
            ? endpoint
            : `${this.baseUrl}/${endpoint.replace(/^\//, '')}`;

        const requestHeaders = { ...headers };

        // Add Content-Type header for JSON requests
        if (body && typeof body === 'object' && !requestHeaders['Content-Type'] && !(body instanceof FormData)) {
            requestHeaders['Content-Type'] = 'application/json';
        }

        // Add auth header if required
        if (requireAuth && this.accessToken) {
            requestHeaders['Authorization'] = `Bearer ${this.accessToken}`;
        }

        // Prepare request options
        const requestOptions = {
            method,
            headers: requestHeaders,
            credentials: 'include',
        };

        // Add body if present
        if (body) {
            requestOptions.body = body instanceof FormData
                ? body
                : JSON.stringify(body);
        }

        // Create abort controller for timeout unless signal is provided
        let abortController;
        if (!signal) {
            abortController = new AbortController();
            requestOptions.signal = abortController.signal;

            // Set timeout
            if (timeout) {
                setTimeout(() => abortController.abort(), timeout);
            }
        } else {
            requestOptions.signal = signal;
        }

        // Make request with retries
        let attempts = 0;
        let lastError;

        while (attempts <= retries) {
            try {
                const response = await fetch(url, requestOptions);

                // Handle authentication errors
                if (response.status === 401 && requireAuth && this.refreshToken) {
                    // Try to refresh the token
                    if (attempts < retries) {
                        try {
                            await this.refreshAccessToken();

                            // Update auth header with new token
                            requestOptions.headers['Authorization'] = `Bearer ${this.accessToken}`;

                            // Try again with new token
                            attempts++;
                            continue;
                        } catch (refreshError) {
                            // If refresh fails, clear tokens and fail the request
                            this.clearTokens();
                            throw new Error('Authentication failed. Please log in again.');
                        }
                    }
                }

                // Handle successful responses
                if (response.ok) {
                    // Check if response is JSON
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        return await response.json();
                    }

                    // Handle binary responses
                    if (contentType && contentType.includes('application/octet-stream')) {
                        return await response.blob();
                    }

                    // Return text for other content types
                    return await response.text();
                }

                // Handle API errors
                const errorData = await response.json().catch(() => ({}));
                const error = new Error(errorData.message || `HTTP error ${response.status}`);
                error.status = response.status;
                error.data = errorData;
                throw error;
            } catch (error) {
                lastError = error;

                // Don't retry aborted requests or auth failures
                if (error.name === 'AbortError' ||
                    (error.message && error.message.includes('Authentication failed'))) {
                    throw error;
                }

                // Check if we should retry
                if (attempts < retries) {
                    // Exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, attempts), 10000);
                    await new Promise(resolve => setTimeout(resolve, delay));

                    attempts++;
                    continue;
                }

                // Max retries reached, throw the error
                throw error;
            }
        }

        throw lastError;
    }

    /**
     * Check if the API is reachable
     * @returns {Promise<boolean>} True if API is reachable
     */
    async checkConnection() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response.ok;
        } catch (error) {
            console.warn('API connection check failed:', error);
            return false;
        }
    }

    // Form API methods

    /**
     * Get form by ID
     * @param {string} formId - Form ID
     * @returns {Promise<Object>} Form data
     */
    async getForm(formId) {
        return this.request(`forms/${formId}`);
    }

    /**
     * Get forms by project ID
     * @param {string} projectId - Project ID
     * @returns {Promise<Array>} Array of forms
     */
    async getFormsByProject(projectId) {
        return this.request(`projects/${projectId}/forms`);
    }

    /**
     * Submit form data
     * @param {Object} formData - Form data to submit
     * @returns {Promise<Object>} Submission result
     */
    async submitForm(formData) {
        return this.request('submissions', {
            method: 'POST',
            body: formData
        });
    }

    /**
     * Get form submissions by form ID
     * @param {string} formId - Form ID
     * @returns {Promise<Array>} Array of submissions
     */
    async getSubmissionsByForm(formId) {
        return this.request(`forms/${formId}/submissions`);
    }

    // Media API methods

    /**
     * Initialize a chunked upload
     * @param {Object} metadata - File metadata
     * @returns {Promise<Object>} Upload initialization data
     */
    async initializeUpload(metadata) {
        return this.request('media/initialize', {
            method: 'POST',
            body: metadata
        });
    }

    /**
     * Upload a chunk of a file
     * @param {string} uploadId - Upload ID
     * @param {number} chunkIndex - Chunk index
     * @param {Blob} chunk - File chunk
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<Object>} Chunk upload result
     */
    async uploadChunk(uploadId, chunkIndex, chunk, metadata = {}) {
        const formData = new FormData();
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', chunkIndex.toString());
        formData.append('chunk', chunk);

        // Add additional metadata
        Object.entries(metadata).forEach(([key, value]) => {
            formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
        });

        return this.request('media/chunk', {
            method: 'POST',
            body: formData,
            timeout: 60000 // Longer timeout for uploads
        });
    }

    /**
     * Complete a chunked upload
     * @param {string} uploadId - Upload ID
     * @param {Object} metadata - Final metadata
     * @returns {Promise<Object>} Complete upload result with file URL
     */
    async completeUpload(uploadId, metadata = {}) {
        return this.request('media/complete', {
            method: 'POST',
            body: {
                uploadId,
                ...metadata
            }
        });
    }

    /**
     * Upload a small file in a single request
     * @param {File} file - File to upload
     * @param {Object} metadata - File metadata
     * @returns {Promise<Object>} Upload result
     */
    async uploadSingleFile(file, metadata = {}) {
        const formData = new FormData();
        formData.append('file', file);

        // Add metadata
        Object.entries(metadata).forEach(([key, value]) => {
            formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
        });

        return this.request('media/upload', {
            method: 'POST',
            body: formData,
            timeout: 60000 // Longer timeout for uploads
        });
    }

    /**
     * Get media by ID
     * @param {string} mediaId - Media ID
     * @returns {Promise<Object>} Media data
     */
    async getMedia(mediaId) {
        return this.request(`media/${mediaId}`);
    }

    // User and authentication methods

    /**
     * Log in user
     * @param {string} username - Username or email
     * @param {string} password - Password
     * @returns {Promise<Object>} Auth result with tokens
     */
    async login(username, password) {
        const result = await this.request('auth/login', {
            method: 'POST',
            body: { username, password },
            requireAuth: false
        });

        if (result.accessToken) {
            this.saveTokens(result.accessToken, result.refreshToken);
        }

        return result;
    }

    /**
     * Log out user
     * @returns {Promise<void>}
     */
    async logout() {
        try {
            await this.request('auth/logout', {
                method: 'POST'
            });
        } finally {
            this.clearTokens();
        }
    }

    /**
     * Get current user profile
     * @returns {Promise<Object>} User profile
     */
    async getUserProfile() {
        return this.request('users/me');
    }

    // Sync API methods

    /**
     * Sync pending submissions
     * @param {Array} submissions - Array of pending submissions
     * @returns {Promise<Object>} Sync result
     */
    async syncSubmissions(submissions) {
        return this.request('sync/submissions', {
            method: 'POST',
            body: { submissions }
        });
    }

    /**
     * Sync pending media uploads
     * @param {Array} mediaItems - Array of pending media items
     * @returns {Promise<Object>} Sync result
     */
    async syncMedia(mediaItems) {
        return this.request('sync/media', {
            method: 'POST',
            body: { mediaItems }
        });
    }

    /**
     * Get sync status
     * @returns {Promise<Object>} Sync status
     */
    async getSyncStatus() {
        return this.request('sync/status');
    }
}

// Create and export a singleton instance
const apiService = new EnhancedApiService();
export default apiService;
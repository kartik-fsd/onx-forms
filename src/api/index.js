// Base URL for API calls
const API_BASE_URL = '/api';

// Helper function to handle fetch responses
const handleResponse = async (response) => {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error ${response.status}`);
    }
    return response.json();
};

// Helper function for API requests with default error handling
const apiRequest = async (endpoint, options = {}) => {
    try {
        const url = `${API_BASE_URL}/${endpoint}`;
        const defaultHeaders = {
            'Content-Type': 'application/json',
        };

        const requestOptions = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers,
            },
        };

        const response = await fetch(url, requestOptions);
        return await handleResponse(response);
    } catch (error) {
        console.error(`API request failed: ${error.message}`);
        throw error;
    }
};

// Form API methods
export const FormAPI = {
    // Get form by ID
    getForm: async (formId) => {
        return apiRequest(`forms/${formId}`);
    },

    // Get forms by project ID
    getFormsByProject: async (projectId) => {
        return apiRequest(`projects/${projectId}/forms`);
    },

    // Submit form data
    submitForm: async (formData) => {
        return apiRequest('submissions', {
            method: 'POST',
            body: JSON.stringify(formData),
        });
    },
};

// Media API methods
export const MediaAPI = {
    // Upload media file
    uploadMedia: async (file, metadata) => {
        const formData = new FormData();
        formData.append('file', file);

        if (metadata) {
            formData.append('metadata', JSON.stringify(metadata));
        }

        return apiRequest('media/upload', {
            method: 'POST',
            headers: {
                // Don't set Content-Type when uploading files with FormData
                // The browser will set it with the correct boundary
            },
            body: formData,
        });
    },

    // Get media by ID
    getMedia: async (mediaId) => {
        return apiRequest(`media/${mediaId}`);
    },
};

// Sync API methods
export const SyncAPI = {
    // Sync pending submissions
    syncSubmissions: async (submissions) => {
        return apiRequest('sync/submissions', {
            method: 'POST',
            body: JSON.stringify({ submissions }),
        });
    },

    // Sync pending media uploads
    syncMedia: async (mediaItems) => {
        return apiRequest('sync/media', {
            method: 'POST',
            body: JSON.stringify({ mediaItems }),
        });
    },
};

// Utility function to detect if we're online
export const isOnline = () => {
    return navigator.onLine;
};

// Function to check if API is reachable
export const checkApiConnection = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            // Short timeout to avoid long waits when offline
            signal: AbortSignal.timeout(3000),
        });

        return response.ok;
    } catch (error) {
        console.warn('API connection check failed:', error);
        return false;
    }
};
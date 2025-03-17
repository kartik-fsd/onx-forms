/**
 * Create a debounced function that delays invoking the provided function
 * until after the specified wait time has elapsed since the last invocation.
 *
 * @param {Function} func - The function to debounce
 * @param {number} wait - The number of milliseconds to delay
 * @param {boolean} immediate - Whether to invoke the function immediately
 * @returns {Function} The debounced function
 */
export const debounce = (func, wait, immediate = false) => {
    let timeout;

    return function executedFunction(...args) {
        const context = this;
        y

        const later = function () {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };

        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);

        if (callNow) func.apply(context, args);
    };
};

/**
 * Generate a unique ID
 * @returns {string} A unique ID
 */
export const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};

/**
 * Format a date string
 * @param {string|Date} date - The date to format
 * @param {string} format - The format to use (default: 'yyyy-MM-dd')
 * @returns {string} The formatted date string
 */
export const formatDate = (date, format = 'yyyy-MM-dd') => {
    if (!date) return '';

    const d = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(d.getTime())) return '';

    const pad = (num) => num.toString().padStart(2, '0');

    const replacements = {
        yyyy: d.getFullYear(),
        MM: pad(d.getMonth() + 1),
        dd: pad(d.getDate()),
        HH: pad(d.getHours()),
        mm: pad(d.getMinutes()),
        ss: pad(d.getSeconds())
    };

    return format.replace(/yyyy|MM|dd|HH|mm|ss/g, match => replacements[match]);
};

/**
 * Format a file size to a human-readable string
 * @param {number} bytes - The file size in bytes
 * @param {number} decimals - The number of decimal places to use
 * @returns {string} The formatted file size
 */
export const formatFileSize = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
};

/**
 * Check if a value is empty (null, undefined, empty string, empty array, or empty object)
 * @param {*} value - The value to check
 * @returns {boolean} True if the value is empty, false otherwise
 */
export const isEmpty = (value) => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
};

/**
 * Safely parse JSON
 * @param {string} str - The JSON string to parse
 * @param {*} fallback - The fallback value to return if parsing fails
 * @returns {*} The parsed JSON or the fallback value
 */
export const safeJsonParse = (str, fallback = null) => {
    try {
        return JSON.parse(str);
    } catch (error) {
        console.error('Error parsing JSON:', error);
        return fallback;
    }
};

/**
 * Get a value from a nested object using a dot-separated path
 * @param {Object} obj - The object to get the value from
 * @param {string} path - The dot-separated path to the value
 * @param {*} defaultValue - The default value to return if the path doesn't exist
 * @returns {*} The value at the specified path or the default value
 */
export const getNestedValue = (obj, path, defaultValue = undefined) => {
    if (!obj || !path) return defaultValue;

    const parts = path.split('.');
    let result = obj;

    for (const part of parts) {
        if (result === null || result === undefined || !Object.prototype.hasOwnProperty.call(result, part)) {
            return defaultValue;
        }
        result = result[part];
    }

    return result;
};

/**
 * Set a value in a nested object using a dot-separated path
 * @param {Object} obj - The object to set the value in
 * @param {string} path - The dot-separated path to the value
 * @param {*} value - The value to set
 * @returns {Object} The modified object
 */
export const setNestedValue = (obj, path, value) => {
    if (!obj || !path) return obj;

    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];

        if (!Object.prototype.hasOwnProperty.call(current, part) ||
            current[part] === null ||
            typeof current[part] !== 'object') {
            current[part] = {};
        }

        current = current[part];
    }

    current[parts[parts.length - 1]] = value;
    return obj;
};

/**
 * Get the base64 data from a data URL
 * @param {string} dataUrl - The data URL
 * @returns {string} The base64 data
 */
export const getBase64FromDataUrl = (dataUrl) => {
    if (!dataUrl) return null;

    const parts = dataUrl.split(',');
    return parts.length > 1 ? parts[1] : null;
};

/**
 * Convert a Blob to a data URL
 * @param {Blob} blob - The Blob to convert
 * @returns {Promise<string>} A Promise that resolves with the data URL
 */
export const blobToDataUrl = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * Compress an image
 * @param {string} dataUrl - The data URL of the image
 * @param {Object} options - Compression options
 * @param {number} options.maxWidth - The maximum width of the compressed image
 * @param {number} options.maxHeight - The maximum height of the compressed image
 * @param {number} options.quality - The quality of the compressed image (0-1)
 * @returns {Promise<string>} A Promise that resolves with the compressed image data URL
 */
export const compressImage = (dataUrl, options = {}) => {
    const { maxWidth = 1280, maxHeight = 720, quality = 0.8 } = options;

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
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

            // Create canvas and context
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Get compressed data URL
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedDataUrl);
        };

        img.onerror = () => {
            reject(new Error('Failed to load image'));
        };

        img.src = dataUrl;
    });
};

/**
 * Check if the device has a camera
 * @returns {Promise<boolean>} A Promise that resolves with true if the device has a camera
 */
export const hasCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return false;
    }

    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.some(device => device.kind === 'videoinput');
    } catch (error) {
        console.error('Error checking for camera:', error);
        return false;
    }
};

/**
 * Check if geolocation is available and permission is granted
 * @returns {Promise<boolean>} A Promise that resolves with true if geolocation is available
 */
export const hasGeolocation = () => {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            () => resolve(true),
            () => resolve(false),
            { timeout: 3000 }
        );
    });
};

/**
 * Get the device type (mobile, tablet, or desktop)
 * @returns {string} The device type
 */
export const getDeviceType = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /mobile|android|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(userAgent);
    const isTablet = /tablet|ipad|playbook|silk|android(?!.*mobile)/i.test(userAgent);

    if (isMobile) return 'mobile';
    if (isTablet) return 'tablet';
    return 'desktop';
};

/**
 * Get network information
 * @returns {Object} Network information
 */
export const getNetworkInfo = () => {
    const connection = navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection;

    if (!connection) {
        return {
            online: navigator.onLine,
            type: 'unknown',
            effectiveType: 'unknown',
            downlink: null,
            rtt: null,
            saveData: false
        };
    }

    return {
        online: navigator.onLine,
        type: connection.type || 'unknown',
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData || false
    };
};

/**
 * Get browser storage estimates
 * @returns {Promise<Object>} A Promise that resolves with storage estimates
 */
export const getStorageEstimates = async () => {
    if (!navigator.storage || !navigator.storage.estimate) {
        return null;
    }

    try {
        const estimate = await navigator.storage.estimate();
        return {
            quota: estimate.quota,
            usage: estimate.usage,
            percentUsed: Math.round((estimate.usage / estimate.quota) * 100),
            remaining: estimate.quota - estimate.usage
        };
    } catch (error) {
        console.error('Error getting storage estimates:', error);
        return null;
    }
};

/**
 * Create a throttled function that limits how often a function can be called
 * @param {Function} func - The function to throttle
 * @param {number} limit - The time limit in milliseconds
 * @returns {Function} The throttled function
 */
export const throttle = (func, limit) => {
    let lastFunc;
    let lastRan;

    return function (...args) {
        const context = this;

        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(() => {
                if (Date.now() - lastRan >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
};

/**
 * Detect network speed
 * @returns {Promise<number>} A Promise that resolves with the download speed in Mbps
 */
export const detectNetworkSpeed = async () => {
    const startTime = Date.now();
    const imageUrl = 'https://via.placeholder.com/500x500.png'; // 500x500 image

    try {
        const response = await fetch(`${imageUrl}?nocache=${startTime}`, {
            cache: 'no-store',
            mode: 'no-cors'
        });

        const blob = await response.blob();
        const endTime = Date.now();

        const durationSeconds = (endTime - startTime) / 1000;
        const fileSizeInBits = blob.size * 8;
        const speedInMbps = (fileSizeInBits / durationSeconds) / (1024 * 1024);

        return speedInMbps;
    } catch (error) {
        console.error('Error detecting network speed:', error);
        return null;
    }
};

/**
 * Create an error handler function that logs and processes errors
 * @param {Function} callback - Optional callback to run after error handling
 * @returns {Function} The error handler function
 */
export const createErrorHandler = (callback) => {
    return (error) => {
        // Log the error
        console.error('Error:', error);

        // Convert error to a standard format
        const standardError = {
            message: error.message || 'An unknown error occurred',
            code: error.code || 'UNKNOWN_ERROR',
            stack: error.stack,
            timestamp: new Date().toISOString()
        };

        // Log to a monitoring service if available
        if (window.errorLoggingService) {
            window.errorLoggingService.logError(standardError);
        }

        // Run callback if provided
        if (typeof callback === 'function') {
            callback(standardError);
        }

        return standardError;
    };
};
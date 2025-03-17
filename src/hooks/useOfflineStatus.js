// src/hooks/useOfflineStatus.js
import { useState, useEffect } from 'preact/hooks';

/**
 * Custom hook for tracking online/offline status
 * 
 * @returns {Object} The current online/offline status
 */
export const useOfflineStatus = () => {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [wasOffline, setWasOffline] = useState(false);
    const [lastOfflineAt, setLastOfflineAt] = useState(null);
    const [lastOnlineAt, setLastOnlineAt] = useState(null);

    useEffect(() => {
        const handleOnline = () => {
            setIsOffline(false);
            setWasOffline(true);
            setLastOnlineAt(new Date());

            // Reset wasOffline after a delay
            setTimeout(() => {
                setWasOffline(false);
            }, 5000);
        };

        const handleOffline = () => {
            setIsOffline(true);
            setLastOfflineAt(new Date());
        };

        // Add event listeners
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Set initial timestamps if needed
        if (navigator.onLine && !lastOnlineAt) {
            setLastOnlineAt(new Date());
        } else if (!navigator.onLine && !lastOfflineAt) {
            setLastOfflineAt(new Date());
        }

        // Clean up
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [lastOfflineAt, lastOnlineAt]);

    // Get connection information if available
    const getConnectionInfo = () => {
        const connection = navigator.connection ||
            navigator.mozConnection ||
            navigator.webkitConnection;

        if (!connection) {
            return {
                type: 'unknown',
                effectiveType: 'unknown',
                downlink: null,
                rtt: null,
                saveData: false
            };
        }

        return {
            type: connection.type || 'unknown',
            effectiveType: connection.effectiveType || 'unknown',
            downlink: connection.downlink,
            rtt: connection.rtt,
            saveData: connection.saveData || false
        };
    };

    return {
        isOffline,
        wasOffline,
        lastOfflineAt,
        lastOnlineAt,
        connectionInfo: getConnectionInfo()
    };
};
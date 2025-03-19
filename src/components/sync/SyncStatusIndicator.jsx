import { useState, useEffect } from "preact/hooks";
import syncManager from "../../services/syncService";
import { useOfflineStatus } from "../../hooks/useOfflineStatus";

/**
 * Component to display sync status with visual indicators
 */
const SyncStatusIndicator = ({ className = "" }) => {
  const [syncStatus, setSyncStatus] = useState({
    isSyncing: false,
    lastSyncTime: null,
    pendingItems: 0,
  });
  const [showDetails, setShowDetails] = useState(false);
  const { isOffline } = useOfflineStatus();

  // Format date to readable string
  const formatDate = (dateString) => {
    if (!dateString) return "Never";

    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Format time elapsed since last sync
  const formatTimeElapsed = (dateString) => {
    if (!dateString) return "";

    const now = new Date();
    const lastSync = new Date(dateString);
    const elapsed = now - lastSync;

    // Less than a minute
    if (elapsed < 60000) {
      return "just now";
    }

    // Less than an hour
    if (elapsed < 3600000) {
      const minutes = Math.floor(elapsed / 60000);
      return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
    }

    // Less than a day
    if (elapsed < 86400000) {
      const hours = Math.floor(elapsed / 3600000);
      return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
    }

    // More than a day
    const days = Math.floor(elapsed / 86400000);
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  };

  // Listen for sync events
  useEffect(() => {
    const handleSyncEvent = (event, data) => {
      switch (event) {
        case "syncStarted":
          setSyncStatus((prev) => ({ ...prev, isSyncing: true }));
          break;

        case "syncCompleted":
          setSyncStatus((prev) => ({
            ...prev,
            isSyncing: false,
            lastSyncTime: data.timestamp || new Date().toISOString(),
            pendingItems: 0,
          }));
          break;

        case "syncFailed":
          setSyncStatus((prev) => ({ ...prev, isSyncing: false }));
          break;

        case "queueUpdated":
          setSyncStatus((prev) => ({ ...prev, pendingItems: data.count || 0 }));
          break;
      }
    };

    // Get initial status
    const initialStatus = syncManager.getSyncStatus();
    setSyncStatus({
      isSyncing: initialStatus.isSyncing,
      lastSyncTime: initialStatus.lastSyncTime,
      pendingItems: 0, // This would come from a real queue count
    });

    // Register listener
    const removeListener = syncManager.addListener(handleSyncEvent);

    // Set up polling for queue count updates
    const pollingInterval = setInterval(() => {
      // In a real implementation, this would query the actual queue
      const queueCount = 0; // Placeholder
      setSyncStatus((prev) => {
        if (prev.pendingItems !== queueCount) {
          return { ...prev, pendingItems: queueCount };
        }
        return prev;
      });
    }, 5000);

    return () => {
      removeListener();
      clearInterval(pollingInterval);
    };
  }, []);

  // Trigger manual sync
  const handleManualSync = () => {
    if (!isOffline && !syncStatus.isSyncing) {
      syncManager.syncAll();
    }
  };

  // Determine status icon and text
  let statusIcon;
  let statusText;
  let statusClass;

  if (isOffline) {
    statusIcon = (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
    );
    statusText = "Offline";
    statusClass = "text-yellow-500";
  } else if (syncStatus.isSyncing) {
    statusIcon = (
      <svg
        className="animate-spin h-5 w-5"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
    );
    statusText = "Syncing...";
    statusClass = "text-blue-500";
  } else if (syncStatus.pendingItems > 0) {
    statusIcon = (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
          clipRule="evenodd"
        />
      </svg>
    );
    statusText = `${syncStatus.pendingItems} pending`;
    statusClass = "text-yellow-500";
  } else {
    statusIcon = (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
    );
    statusText = "Synced";
    statusClass = "text-green-500";
  }

  return (
    <div className={`relative ${className}`}>
      <div
        className={`flex items-center space-x-1 px-3 py-1 rounded-md cursor-pointer hover:bg-gray-100 ${statusClass}`}
        onClick={() => setShowDetails(!showDetails)}
      >
        {statusIcon}
        <span className="text-sm font-medium">{statusText}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {showDetails && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg z-10 border border-gray-200">
          <div className="p-4">
            <div className="mb-3">
              <h3 className="text-sm font-medium text-gray-700">Sync Status</h3>
              <div className="mt-1 flex justify-between text-xs text-gray-500">
                <span>Last synced:</span>
                <span className="font-medium">
                  {syncStatus.lastSyncTime
                    ? formatTimeElapsed(syncStatus.lastSyncTime)
                    : "Never"}
                </span>
              </div>
              {syncStatus.lastSyncTime && (
                <div className="mt-1 flex justify-between text-xs text-gray-500">
                  <span>Sync time:</span>
                  <span>{formatDate(syncStatus.lastSyncTime)}</span>
                </div>
              )}
              {syncStatus.pendingItems > 0 && (
                <div className="mt-1 flex justify-between text-xs text-gray-500">
                  <span>Pending items:</span>
                  <span className="font-medium text-yellow-600">
                    {syncStatus.pendingItems}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={handleManualSync}
              disabled={isOffline || syncStatus.isSyncing}
              className="w-full px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncStatus.isSyncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncStatusIndicator;

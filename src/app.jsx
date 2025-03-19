import { useState, useEffect } from "preact/hooks";
import { Router, Route } from "preact-router";
import { FormProvider } from "./context/FormContext";
import HomePage from "./pages/HomePage";
import FormPage from "./pages/FormPage";
import NotFoundPage from "./pages/NotFoundPage";
import SyncStatusIndicator from "./components/sync/SyncStatusIndicator";
import { useOfflineStatus } from "./hooks/useOfflineStatus";
import { registerServiceWorker } from "./utils/serviceWorker";
import syncManager from "./services/syncService";
import Toast from "./components/common/Toast";

const App = () => {
  const { isOffline, wasOffline } = useOfflineStatus();
  const [toast, setToast] = useState(null);
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);
  const [syncEvents, setSyncEvents] = useState([]);

  // Register service worker and setup network/sync handlers
  useEffect(() => {
    // Register service worker
    const swRegistration = registerServiceWorker();

    // Set up sync event listeners
    const handleSyncEvent = (event, data) => {
      switch (event) {
        case "syncCompleted":
          // Show toast notification for completed sync
          setToast({
            type: "success",
            message: `Sync completed: ${data.syncedForms || 0} forms and ${
              data.syncedMedia || 0
            } media items uploaded.`,
            duration: 5000,
          });

          // Add to sync events log (limited to last 10)
          setSyncEvents((prev) => {
            const newEvents = [
              {
                id: Date.now(),
                type: "success",
                message: `Sync completed with ${
                  data.syncedForms || 0
                } forms and ${data.syncedMedia || 0} media items`,
                timestamp: new Date().toISOString(),
              },
              ...prev,
            ].slice(0, 10);

            return newEvents;
          });
          break;

        case "syncFailed":
          // Show toast notification for failed sync
          setToast({
            type: "error",
            message: `Sync failed: ${data.error || "Unknown error"}`,
            duration: 8000,
          });

          // Add to sync events log
          setSyncEvents((prev) => {
            const newEvents = [
              {
                id: Date.now(),
                type: "error",
                message: `Sync failed: ${data.error || "Unknown error"}`,
                timestamp: new Date().toISOString(),
              },
              ...prev,
            ].slice(0, 10);

            return newEvents;
          });
          break;

        case "networkStatusChanged":
          // If we came back online, show notification
          if (data.isOnline && wasOffline) {
            setToast({
              type: "info",
              message:
                "You are back online. Your data will be synced automatically.",
              duration: 3000,
            });
          }
          break;
      }
    };

    // Register sync listener
    const removeSyncListener = syncManager.addListener(handleSyncEvent);

    // Listen for service worker messages
    const handleServiceWorkerMessage = (event) => {
      if (!event.data) return;

      switch (event.data.type) {
        case "SW_INSTALLED":
          // Show toast for new service worker installation
          setToast({
            type: "info",
            message: "App updated to new version.",
            duration: 3000,
          });
          break;

        case "SW_UPDATE_AVAILABLE":
          // Show update banner
          setSwUpdateAvailable(true);
          break;

        case "SYNC_COMPLETED":
          // Forward to sync manager
          syncManager.notifyListeners("syncCompleted", event.data);
          break;

        case "SYNC_FAILED":
          // Forward to sync manager
          syncManager.notifyListeners("syncFailed", event.data);
          break;
      }
    };

    // Add service worker message listener
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener(
        "message",
        handleServiceWorkerMessage
      );
    }

    // Initialize the sync manager
    syncManager.init();

    // Clean up event listeners
    return () => {
      removeSyncListener();
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener(
          "message",
          handleServiceWorkerMessage
        );
      }
    };
  }, [wasOffline]);

  // Effect for online/offline status changes
  useEffect(() => {
    // Notify service worker of network status change
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "NETWORK_STATUS",
        isOnline: !isOffline,
      });
    }

    // If we just came back online, trigger a sync
    if (!isOffline && wasOffline) {
      syncManager.syncAll();
    }
  }, [isOffline, wasOffline]);

  // Handle update available
  const handleUpdate = () => {
    // Reload the page to activate the new service worker
    window.location.reload();
  };

  // Close toast
  const closeToast = () => {
    setToast(null);
  };

  return (
    <FormProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Header with sync status */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex-shrink-0">
                <h1 className="text-lg font-bold text-gray-900">
                  FSE Lead Collection
                </h1>
              </div>

              <div className="flex items-center space-x-4">
                {/* Sync status indicator */}
                <SyncStatusIndicator />

                {/* Offline indicator */}
                {isOffline && (
                  <div className="bg-yellow-100 text-yellow-800 text-sm px-3 py-1 rounded-full flex items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 mr-1"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Offline</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1">
          <Router>
            <Route
              path="/"
              component={(props) => (
                <HomePage {...props} syncEvents={syncEvents} />
              )}
            />
            <Route path="/form/:projectId/:formId" component={FormPage} />
            <Route
              path="/form/:projectId/:formId/draft/:draftId"
              component={FormPage}
            />
            <Route default component={NotFoundPage} />
          </Router>
        </main>

        {/* Update banner */}
        {swUpdateAvailable && (
          <div className="fixed inset-x-0 bottom-0 bg-blue-600 text-white p-4">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
              <div className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <p>A new version of the app is available.</p>
              </div>
              <button
                onClick={handleUpdate}
                className="ml-4 px-4 py-2 bg-white text-blue-600 rounded-md shadow-sm hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600"
              >
                Update Now
              </button>
            </div>
          </div>
        )}

        {/* Toast notification */}
        {toast && (
          <Toast
            type={toast.type}
            message={toast.message}
            duration={toast.duration}
            onClose={closeToast}
          />
        )}

        {/* Offline indicator for mobile */}
        <div
          className={`fixed bottom-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded-md shadow-lg transition-opacity duration-300 md:hidden ${
            isOffline
              ? "opacity-100"
              : wasOffline
              ? "opacity-100"
              : "opacity-0 pointer-events-none"
          }`}
        >
          {isOffline
            ? "You are currently offline. Your data will be saved locally."
            : "You are back online. Your data will be synced."}
        </div>
      </div>
    </FormProvider>
  );
};

export default App;

import { useState, useEffect } from "preact/hooks";
import { Router, Route } from "preact-router";
import { FormProvider } from "./context/FormContext";
import HomePage from "./pages/HomePage";
import FormPage from "./pages/FormPage";
import NotFoundPage from "./pages/NotFoundPage";
import { registerServiceWorker } from "./utils/serviceWorker";

const App = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineIndicatorVisible, setOfflineIndicatorVisible] = useState(false);

  // Register service worker and set up network status monitoring
  useEffect(() => {
    // Register service worker
    registerServiceWorker();

    // Set up online/offline event listeners
    const handleOnline = () => {
      setIsOnline(true);
      setOfflineIndicatorVisible(false);

      // Notify service worker
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "NETWORK_STATUS",
          isOnline: true,
        });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setOfflineIndicatorVisible(true);

      // Notify service worker
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "NETWORK_STATUS",
          isOnline: false,
        });
      }
    };

    // Listen for messages from service worker
    const handleMessage = (event) => {
      if (event.data && event.data.type === "NETWORK_STATUS_CHANGE") {
        setIsOnline(event.data.isOnline);
        setOfflineIndicatorVisible(!event.data.isOnline);
      }
    };

    // Add event listeners
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    navigator.serviceWorker.addEventListener("message", handleMessage);

    // Clean up
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, []);

  // Hide offline indicator after a delay
  useEffect(() => {
    let timer;
    if (!isOnline) {
      setOfflineIndicatorVisible(true);
    } else if (offlineIndicatorVisible) {
      timer = setTimeout(() => {
        setOfflineIndicatorVisible(false);
      }, 3000);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOnline, offlineIndicatorVisible]);

  return (
    <FormProvider>
      <div className="min-h-screen bg-gray-50">
        <Router>
          <Route path="/" component={HomePage} />
          <Route path="/form/:projectId/:formId" component={FormPage} />
          <Route
            path="/form/:projectId/:formId/draft/:draftId"
            component={FormPage}
          />
          <Route default component={NotFoundPage} />
        </Router>

        {/* Offline indicator */}
        <div
          className={`fixed bottom-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded-md shadow-lg transition-opacity duration-300 ${
            offlineIndicatorVisible
              ? "opacity-100"
              : "opacity-0 pointer-events-none"
          }`}
        >
          {isOnline
            ? "You are back online. Your data will be synced."
            : "You are currently offline. Your data will be saved locally."}
        </div>
      </div>
    </FormProvider>
  );
};

export default App;

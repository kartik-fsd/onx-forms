import { h } from "preact";
import { render } from "preact";
import App from "./app.jsx";
import "./index.css";
import { initOfflineCapability } from "./utils/serviceWorker";

// Initialize offline capabilities
initOfflineCapability();
// Render the app
render(h(App, null), document.getElementById("app"));

// Add online/offline event listeners for UI updates
window.addEventListener("online", () => {
  const offlineIndicator = document.getElementById("offline-indicator");
  if (offlineIndicator) {
    offlineIndicator.textContent =
      "You are back online. Your data will be synced.";
    offlineIndicator.classList.remove("hidden");

    // Hide the indicator after 3 seconds
    setTimeout(() => {
      offlineIndicator.classList.add("hidden");
    }, 3000);
  }
});

window.addEventListener("offline", () => {
  const offlineIndicator = document.getElementById("offline-indicator");
  if (offlineIndicator) {
    offlineIndicator.textContent =
      "You are currently offline. Your data will be saved locally.";
    offlineIndicator.classList.remove("hidden");
  }
});

// Add service worker message handling
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SYNC_COMPLETED") {
      console.log("Sync completed:", event.data);

      // Show a sync completed notification
      const offlineIndicator = document.getElementById("offline-indicator");
      if (offlineIndicator) {
        offlineIndicator.textContent = `Sync completed: ${event.data.syncedItems} items synced.`;
        offlineIndicator.classList.remove("hidden");

        // Hide the indicator after 3 seconds
        setTimeout(() => {
          offlineIndicator.classList.add("hidden");
        }, 3000);
      }
    }
  });
}

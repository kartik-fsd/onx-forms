import { useState, useEffect } from "preact/hooks";
import mediaUploadService from "../../services/mediaUploadServices";

/**
 * Component to display media upload progress
 */
const UploadProgressIndicator = ({
  mediaId,
  onComplete,
  showInline = true,
  className = "",
}) => {
  const [progress, setProgress] = useState({
    status: "pending",
    percentage: 0,
    error: null,
    url: null,
  });

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Listen for upload progress
  useEffect(() => {
    if (!mediaId) return;

    // Get initial progress
    const getInitialProgress = async () => {
      try {
        const progressData = await mediaUploadService.getUploadProgress(
          mediaId
        );
        setProgress({
          status: progressData.status,
          percentage: progressData.percentage || 0,
          error: progressData.error,
          url: progressData.serverUrl,
        });

        // Notify completion if already complete
        if (
          progressData.status === "completed" &&
          typeof onComplete === "function"
        ) {
          onComplete(progressData.serverUrl);
        }
      } catch (error) {
        console.error("Error getting upload progress:", error);
        setProgress((prev) => ({
          ...prev,
          status: "error",
          error: error.message,
        }));
      }
    };

    getInitialProgress();

    // Set up listener
    const listener = (event) => {
      if (event.mediaId !== mediaId) return;

      if (event.type === "progress") {
        setProgress((prev) => ({
          ...prev,
          status: "uploading",
          percentage: event.percentage,
        }));
      } else if (event.type === "complete") {
        setProgress((prev) => ({
          ...prev,
          status: "completed",
          percentage: 100,
          url: event.url,
        }));

        // Notify completion
        if (typeof onComplete === "function") {
          onComplete(event.url);
        }
      }
    };

    const removeListener = mediaUploadService.addListener(listener);

    return () => {
      removeListener();
    };
  }, [mediaId, onComplete]);

  // Retry upload
  const handleRetry = async () => {
    try {
      await mediaUploadService.addToUploadQueue(mediaId);

      setProgress((prev) => ({
        ...prev,
        status: "pending",
        error: null,
      }));
    } catch (error) {
      console.error("Error retrying upload:", error);
      setProgress((prev) => ({
        ...prev,
        error: error.message,
      }));
    }
  };

  // Cancel upload - not implemented in the service yet
  const handleCancel = () => {
    // This would call a cancelUpload method in the service
    console.log("Cancel upload not implemented");
  };

  // Render different UI based on status

  // Completed
  if (progress.status === "completed" && !showInline) {
    return null; // Hide if complete and not showing inline
  }

  // Inline compact display
  if (showInline) {
    let statusIcon;
    let statusText;
    let statusClass;

    switch (progress.status) {
      case "uploading":
        statusIcon = (
          <svg
            className="animate-spin h-4 w-4"
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
        statusText = `Uploading ${progress.percentage}%`;
        statusClass = "text-blue-600";
        break;

      case "completed":
        statusIcon = (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
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
        statusText = "Uploaded";
        statusClass = "text-green-600";
        break;

      case "error":
        statusIcon = (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
        statusText = "Upload failed";
        statusClass = "text-red-600";
        break;

      case "pending":
      default:
        statusIcon = (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
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
        statusText = "Waiting to upload";
        statusClass = "text-gray-600";
        break;
    }

    return (
      <div
        className={`flex items-center space-x-1 text-xs ${statusClass} ${className}`}
      >
        {statusIcon}
        <span>{statusText}</span>
        {progress.status === "error" && (
          <button
            onClick={handleRetry}
            className="text-blue-600 hover:text-blue-800 ml-2 focus:outline-none"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // Detailed view with progress bar
  return (
    <div
      className={`bg-gray-50 border border-gray-200 rounded-md p-3 ${className}`}
    >
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-700">
          {progress.status === "uploading"
            ? "Uploading..."
            : progress.status === "completed"
            ? "Upload complete"
            : progress.status === "error"
            ? "Upload failed"
            : "Waiting to upload"}
        </span>

        {/* Actions based on status */}
        <div className="flex space-x-2">
          {progress.status === "error" && (
            <button
              onClick={handleRetry}
              className="text-xs text-blue-600 hover:text-blue-800 focus:outline-none"
            >
              Retry
            </button>
          )}

          {(progress.status === "pending" ||
            progress.status === "uploading") && (
            <button
              onClick={handleCancel}
              className="text-xs text-gray-600 hover:text-gray-800 focus:outline-none"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={`${
            progress.status === "error"
              ? "bg-red-600"
              : progress.status === "completed"
              ? "bg-green-600"
              : "bg-blue-600"
          } h-2.5 rounded-full`}
          style={{ width: `${progress.percentage}%` }}
        ></div>
      </div>

      {/* Additional info */}
      <div className="flex justify-between mt-1">
        <span className="text-xs text-gray-500">
          {progress.percentage}% {progress.status === "uploading" && "uploaded"}
        </span>

        {progress.error && (
          <span className="text-xs text-red-600" title={progress.error}>
            Error:{" "}
            {progress.error.length > 30
              ? progress.error.substring(0, 30) + "..."
              : progress.error}
          </span>
        )}
      </div>
    </div>
  );
};

export default UploadProgressIndicator;

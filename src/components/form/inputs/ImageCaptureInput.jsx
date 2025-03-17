import { useState, useRef, useEffect } from "preact/hooks";
import { MediaDAO } from "../../../db";

const ImageCaptureInput = ({
  id,
  name,
  label,
  value = null,
  onChange,
  required = false,
  disabled = false,
  error,
  hint,
  quality = 0.8,
  maxWidth = 1280,
  maxHeight = 720,
  className = "",
  ...props
}) => {
  const [stream, setStream] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraAvailable, setIsCameraAvailable] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(value);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Check camera availability on component mount
  useEffect(() => {
    const checkCameraAvailability = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some(
          (device) => device.kind === "videoinput"
        );
        setIsCameraAvailable(hasCamera);
      } catch (error) {
        console.error("Error checking camera availability:", error);
        setIsCameraAvailable(false);
      }
    };

    checkCameraAvailability();

    // Set preview if value already exists
    if (value && typeof value === "string") {
      setPreviewUrl(value);
    }
  }, [value]);

  // Start/stop camera stream when isCameraOpen changes
  useEffect(() => {
    if (isCameraOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isCameraOpen]);

  // Start the camera stream
  const startCamera = async () => {
    try {
      setIsCapturing(true);
      const constraints = {
        video: {
          facingMode: "environment", // Use the back camera if available
          width: { ideal: maxWidth },
          height: { ideal: maxHeight },
        },
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(
        constraints
      );
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      setIsCapturing(false);
    } catch (error) {
      console.error("Error accessing camera:", error);
      setIsCameraAvailable(false);
      setIsCapturing(false);
      setIsCameraOpen(false);
    }
  };

  // Stop the camera stream
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  // Open camera button handler
  const handleOpenCamera = () => {
    setIsCameraOpen(true);
  };

  // Close camera button handler
  const handleCloseCamera = () => {
    setIsCameraOpen(false);
  };

  // Capture image from camera
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to data URL with specified quality
    const dataUrl = canvas.toDataURL("image/jpeg", quality);

    // Create a blob for storage
    const createBlob = async () => {
      try {
        // Convert data URL to Blob
        const res = await fetch(dataUrl);
        const blob = await res.blob();

        // Store the blob and get a reference
        const mediaData = {
          fieldName: name,
          type: "image/jpeg",
          data: blob,
          timestamp: new Date().toISOString(),
        };

        const mediaId = await MediaDAO.saveMedia(mediaData);

        // Update the value with the reference info
        onChange({
          dataUrl,
          mediaId,
          timestamp: mediaData.timestamp,
        });

        // Set preview
        setPreviewUrl(dataUrl);

        // Close camera
        setIsCameraOpen(false);
      } catch (error) {
        console.error("Error creating blob:", error);
      }
    };

    createBlob();
  };

  // File input change handler (alternative to camera)
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Only accept images
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    try {
      // Read file as data URL
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target.result;

        // Convert to blob
        const res = await fetch(dataUrl);
        const blob = await res.blob();

        // Store the blob and get a reference
        const mediaData = {
          fieldName: name,
          type: file.type,
          data: blob,
          timestamp: new Date().toISOString(),
        };

        const mediaId = await MediaDAO.saveMedia(mediaData);

        // Update the value with the reference info
        onChange({
          dataUrl,
          mediaId,
          timestamp: mediaData.timestamp,
        });

        // Set preview
        setPreviewUrl(dataUrl);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error processing file:", error);
    }
  };

  // Remove image handler
  const handleRemoveImage = () => {
    onChange(null);
    setPreviewUrl(null);
  };

  return (
    <div className={`relative ${className}`}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Image preview */}
      {previewUrl && (
        <div className="mb-3 relative">
          <img
            src={previewUrl}
            alt="Preview"
            className="max-w-full max-h-56 rounded-md border border-gray-300"
          />
          <button
            type="button"
            onClick={handleRemoveImage}
            className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            aria-label="Remove image"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Camera view when open */}
      {isCameraOpen && (
        <div className="mb-3">
          <div className="relative bg-black rounded-md overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full max-h-80 object-cover"
            />
            <div className="absolute bottom-3 left-0 right-0 flex justify-center space-x-3">
              <button
                type="button"
                onClick={handleCapture}
                className="bg-white text-gray-800 px-4 py-2 rounded-full shadow hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Capture
              </button>
              <button
                type="button"
                onClick={handleCloseCamera}
                className="bg-gray-800 text-white px-4 py-2 rounded-full shadow hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Actions */}
      {!isCameraOpen && (
        <div className="flex flex-wrap gap-2">
          {isCameraAvailable && (
            <button
              type="button"
              onClick={handleOpenCamera}
              disabled={disabled || isCapturing}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
            >
              {isCapturing ? (
                <>
                  <span className="animate-spin h-4 w-4 mr-2 border-b-2 border-white rounded-full"></span>
                  Opening Camera...
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  Open Camera
                </>
              )}
            </button>
          )}

          <label
            htmlFor={`${id}-file-input`}
            className="flex items-center px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
                clip-rule="evenodd"
              />
            </svg>
            Upload Image
            <input
              id={`${id}-file-input`}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={disabled}
              className="sr-only"
            />
          </label>
        </div>
      )}

      {/* Error message or hint */}
      {(error || hint) && (
        <p
          id={`${id}-description`}
          className={`mt-1 text-sm ${error ? "text-red-600" : "text-gray-500"}`}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
};

export default ImageCaptureInput;

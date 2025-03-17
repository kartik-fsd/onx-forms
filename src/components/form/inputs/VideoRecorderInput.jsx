import { useState, useRef, useEffect } from "preact/hooks";
import { v4 as uuidv4 } from "uuid";

/**
 * Video recording input component
 */
const VideoRecorderInput = ({
  id,
  name,
  label,
  value = null,
  onChange,
  required = false,
  disabled = false,
  error,
  hint,
  maxDuration = 60, // Max recording duration in seconds
  maxFileSize = 50 * 1024 * 1024, // 50MB default limit
  videoWidth = 640,
  videoHeight = 480,
  className = "",
  ...props
}) => {
  // State
  const [stream, setStream] = useState(null);
  const [isRecorderAvailable, setIsRecorderAvailable] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [videoBlob, setVideoBlob] = useState(value?.blob || null);
  const [videoUrl, setVideoUrl] = useState(value?.url || null);
  const [isInitializingCamera, setIsInitializingCamera] = useState(false);
  const [permissionError, setPermissionError] = useState(null);

  // Refs
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const durationTimerRef = useRef(null);

  // Check device capabilities on mount
  useEffect(() => {
    const checkDeviceCapabilities = async () => {
      try {
        // Check if MediaRecorder is available
        if (!window.MediaRecorder) {
          setIsRecorderAvailable(false);
          setPermissionError("Your browser does not support video recording");
          return;
        }

        // Check if camera is available
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some(
          (device) => device.kind === "videoinput"
        );

        if (!hasCamera) {
          setIsRecorderAvailable(false);
          setPermissionError("No camera found on your device");
        }
      } catch (err) {
        console.error("Error checking device capabilities:", err);
        setIsRecorderAvailable(false);
        setPermissionError("Failed to access device capabilities");
      }
    };

    checkDeviceCapabilities();

    // Clean up on unmount
    return stopCamera;
  }, []);

  // Set up preview if we have a video URL
  useEffect(() => {
    if (videoUrl && videoRef.current) {
      videoRef.current.src = videoUrl;
    }
  }, [videoUrl]);

  // Start camera
  const startCamera = async () => {
    if (!isRecorderAvailable || disabled) return;

    try {
      setIsInitializingCamera(true);
      setPermissionError(null);

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: videoWidth },
          height: { ideal: videoHeight },
          facingMode: "user",
        },
        audio: true,
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      // Create media recorder
      const recorder = new MediaRecorder(mediaStream);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });

        // Check if the file is too large
        if (blob.size > maxFileSize) {
          setPermissionError(
            `Video size exceeds the maximum limit of ${formatFileSize(
              maxFileSize
            )}`
          );
          chunksRef.current = [];
          return;
        }

        // Create URL for the video blob
        const url = URL.createObjectURL(blob);
        setVideoBlob(blob);
        setVideoUrl(url);
        chunksRef.current = [];

        // Notify parent component
        const videoId = uuidv4();
        onChange({
          id: videoId,
          blob,
          url,
          type: "video/webm",
          size: blob.size,
          duration: recordingDuration,
          timestamp: new Date().toISOString(),
        });
      };

      mediaRecorderRef.current = recorder;
      setIsInitializingCamera(false);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setPermissionError(
        err.name === "NotAllowedError"
          ? "Camera access permission denied. Please allow access to your camera."
          : `Failed to access camera: ${err.message}`
      );
      setIsInitializingCamera(false);
    }
  };

  // Stop camera
  const stopCamera = () => {
    // Stop media recorder
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    // Stop all tracks in the stream
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    // Clear video source
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject = null;
    }

    // Clear timers
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
    }

    setRecordingDuration(0);
  };

  // Start recording
  const startRecording = () => {
    if (!mediaRecorderRef.current || isRecording || disabled) return;

    // Reset chunks
    chunksRef.current = [];

    // Start recording
    mediaRecorderRef.current.start();
    setIsRecording(true);

    // Start duration timer
    setRecordingDuration(0);
    durationTimerRef.current = setInterval(() => {
      setRecordingDuration((prev) => {
        // Stop recording when max duration is reached
        if (prev >= maxDuration - 1) {
          stopRecording();
          return maxDuration;
        }
        return prev + 1;
      });
    }, 1000);

    // Set a timeout to stop recording after maxDuration
    timerRef.current = setTimeout(() => {
      stopRecording();
    }, maxDuration * 1000);
  };

  // Stop recording
  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    // Stop recorder
    mediaRecorderRef.current.stop();
    setIsRecording(false);

    // Clear timers
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
    }
  };

  // Format duration as MM:SS
  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Clear recorded video
  const clearVideo = () => {
    // Revoke URL to prevent memory leaks
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }

    setVideoBlob(null);
    setVideoUrl(null);
    onChange(null);
  };

  // Toggle between camera and playback
  const toggleCameraAndPlayback = () => {
    if (videoUrl) {
      clearVideo();
      startCamera();
    } else {
      stopCamera();
    }
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

      <div className="border border-gray-300 rounded-md overflow-hidden bg-black">
        {/* Video preview */}
        <div className="relative aspect-video">
          <video
            ref={videoRef}
            className="w-full h-full"
            autoPlay={!videoUrl}
            muted={!videoUrl}
            controls={!!videoUrl}
            playsInline
          />

          {/* Show loading indicator when initializing camera */}
          {isInitializingCamera && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white">
              <div className="flex flex-col items-center">
                <svg
                  className="animate-spin h-8 w-8 mb-2"
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
                <span>Initializing camera...</span>
              </div>
            </div>
          )}

          {/* Show error if camera is not available */}
          {permissionError && !stream && !videoUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 text-white p-4 text-center">
              <div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 mx-auto mb-2 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p>{permissionError}</p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="mt-3 px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Show placeholder if no stream or video */}
          {!stream &&
            !videoUrl &&
            !isInitializingCamera &&
            !permissionError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
                <div className="text-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12 mx-auto mb-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <p>Click 'Start Camera' to begin</p>
                </div>
              </div>
            )}

          {/* Recording indicator */}
          {isRecording && (
            <div className="absolute top-2 left-2 flex items-center bg-black bg-opacity-50 text-white px-2 py-1 rounded-md">
              <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse mr-2"></span>
              <span>{formatDuration(recordingDuration)}</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-t border-gray-300">
          <div>
            {/* Start Camera button - shown if no stream and no video */}
            {!stream && !videoUrl && !isInitializingCamera && (
              <button
                type="button"
                onClick={startCamera}
                disabled={
                  disabled || !isRecorderAvailable || isInitializingCamera
                }
                className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
              >
                Start Camera
              </button>
            )}

            {/* Recording controls - shown if stream is active */}
            {stream && !videoUrl && (
              <>
                {isRecording ? (
                  <button
                    type="button"
                    onClick={stopRecording}
                    disabled={disabled}
                    className="px-3 py-1 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 disabled:opacity-50"
                  >
                    Stop Recording
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={disabled}
                    className="px-3 py-1 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 disabled:opacity-50"
                  >
                    Start Recording
                  </button>
                )}
              </>
            )}

            {/* Re-record button - shown if video is recorded */}
            {videoUrl && (
              <button
                type="button"
                onClick={toggleCameraAndPlayback}
                disabled={
                  disabled || !isRecorderAvailable || isInitializingCamera
                }
                className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
              >
                Record New Video
              </button>
            )}
          </div>

          <div>
            {/* Stop camera button - shown if stream is active */}
            {stream && (
              <button
                type="button"
                onClick={stopCamera}
                className="ml-2 text-sm text-gray-600 hover:text-gray-800 focus:outline-none focus:underline"
              >
                Cancel
              </button>
            )}

            {/* Clear video button - shown if video is recorded */}
            {videoUrl && (
              <button
                type="button"
                onClick={clearVideo}
                className="ml-2 text-sm text-red-600 hover:text-red-800 focus:outline-none focus:underline"
              >
                Clear Video
              </button>
            )}
          </div>
        </div>
      </div>

      {/* File info - shown if video is recorded */}
      {videoBlob && (
        <div className="mt-1 text-xs text-gray-500">
          Size: {formatFileSize(videoBlob.size)} | Duration:{" "}
          {formatDuration(recordingDuration)}
        </div>
      )}

      {/* Error message or hint */}
      {(error || hint) && !permissionError && (
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

export default VideoRecorderInput;

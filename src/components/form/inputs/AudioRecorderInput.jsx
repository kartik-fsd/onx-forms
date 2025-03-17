import { useState, useRef, useEffect } from "preact/hooks";
import { v4 as uuidv4 } from "uuid";

/**
 * Audio recording input component
 */
const AudioRecorderInput = ({
  id,
  name,
  label,
  value = null,
  onChange,
  required = false,
  disabled = false,
  error,
  hint,
  maxDuration = 180, // Max recording duration in seconds (3 minutes)
  maxFileSize = 10 * 1024 * 1024, // 10MB default limit
  className = "",
  ...props
}) => {
  // State
  const [stream, setStream] = useState(null);
  const [isRecorderAvailable, setIsRecorderAvailable] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBlob, setAudioBlob] = useState(value?.blob || null);
  const [audioUrl, setAudioUrl] = useState(value?.url || null);
  const [isInitializingMic, setIsInitializingMic] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [visualizerData, setVisualizerData] = useState(Array(50).fill(0));

  // Refs
  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const durationTimerRef = useRef(null);
  const analyserRef = useRef(null);
  const visualizerTimerRef = useRef(null);

  // Check device capabilities on mount
  useEffect(() => {
    const checkDeviceCapabilities = async () => {
      try {
        // Check if MediaRecorder is available
        if (!window.MediaRecorder) {
          setIsRecorderAvailable(false);
          setPermissionError("Your browser does not support audio recording");
          return;
        }

        // Check if microphone is available
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasMicrophone = devices.some(
          (device) => device.kind === "audioinput"
        );

        if (!hasMicrophone) {
          setIsRecorderAvailable(false);
          setPermissionError("No microphone found on your device");
        }
      } catch (err) {
        console.error("Error checking device capabilities:", err);
        setIsRecorderAvailable(false);
        setPermissionError("Failed to access device capabilities");
      }
    };

    checkDeviceCapabilities();

    // Clean up on unmount
    return stopMicrophone;
  }, []);

  // Set up audio player if we have an audio URL
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl;

      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const handleEnded = () => setIsPlaying(false);

      audioRef.current.addEventListener("play", handlePlay);
      audioRef.current.addEventListener("pause", handlePause);
      audioRef.current.addEventListener("ended", handleEnded);

      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener("play", handlePlay);
          audioRef.current.removeEventListener("pause", handlePause);
          audioRef.current.removeEventListener("ended", handleEnded);
        }
      };
    }
  }, [audioUrl]);

  // Start microphone
  const startMicrophone = async () => {
    if (!isRecorderAvailable || disabled) return;

    try {
      setIsInitializingMic(true);
      setPermissionError(null);

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setStream(mediaStream);

      // Create media recorder
      const recorder = new MediaRecorder(mediaStream);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });

        // Check if the file is too large
        if (blob.size > maxFileSize) {
          setPermissionError(
            `Audio size exceeds the maximum limit of ${formatFileSize(
              maxFileSize
            )}`
          );
          chunksRef.current = [];
          return;
        }

        // Create URL for the audio blob
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        chunksRef.current = [];

        // Notify parent component
        const audioId = uuidv4();
        onChange({
          id: audioId,
          blob,
          url,
          type: "audio/webm",
          size: blob.size,
          duration: recordingDuration,
          timestamp: new Date().toISOString(),
        });
      };

      mediaRecorderRef.current = recorder;

      // Set up audio analyser for visualizer
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(mediaStream);

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      analyserRef.current = analyser;

      // Start visualizer
      startVisualizer();

      setIsInitializingMic(false);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setPermissionError(
        err.name === "NotAllowedError"
          ? "Microphone access permission denied. Please allow access to your microphone."
          : `Failed to access microphone: ${err.message}`
      );
      setIsInitializingMic(false);
    }
  };

  // Stop microphone
  const stopMicrophone = () => {
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

    // Clear timers
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
    }

    if (visualizerTimerRef.current) {
      cancelAnimationFrame(visualizerTimerRef.current);
    }

    setRecordingDuration(0);

    // Reset visualizer
    setVisualizerData(Array(50).fill(0));
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

  // Start visualizer
  const startVisualizer = () => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVisualizer = () => {
      if (!analyserRef.current) return;

      analyser.getByteFrequencyData(dataArray);

      // Average frequency values to get 50 data points
      const dataPoints = 50;
      const blockSize = Math.floor(bufferLength / dataPoints);
      const values = Array(dataPoints).fill(0);

      for (let i = 0; i < dataPoints; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += dataArray[i * blockSize + j];
        }
        values[i] = sum / blockSize / 255; // Normalize to 0-1
      }

      setVisualizerData(values);
      visualizerTimerRef.current = requestAnimationFrame(updateVisualizer);
    };

    visualizerTimerRef.current = requestAnimationFrame(updateVisualizer);
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

  // Clear recorded audio
  const clearAudio = () => {
    // Revoke URL to prevent memory leaks
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    setAudioBlob(null);
    setAudioUrl(null);
    onChange(null);
  };

  // Toggle play/pause
  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
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

      <div className="border border-gray-300 rounded-md overflow-hidden">
        {/* Audio visualizer/waveform */}
        <div className="relative bg-gray-100 h-24 p-2">
          {/* Hidden audio element for playback */}
          <audio ref={audioRef} className="hidden" />

          {/* Visualizer */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-16 flex items-center justify-between px-4">
              {visualizerData.map((value, index) => (
                <div
                  key={index}
                  className="w-1 bg-blue-500 rounded-full mx-px"
                  style={{
                    height: `${Math.max(4, value * 100)}%`,
                    opacity: isRecording ? 1 : 0.6,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Show loading indicator when initializing microphone */}
          {isInitializingMic && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-80">
              <div className="flex flex-col items-center">
                <svg
                  className="animate-spin h-8 w-8 mb-2 text-blue-500"
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
                <span className="text-sm text-gray-600">
                  Initializing microphone...
                </span>
              </div>
            </div>
          )}

          {/* Show error if microphone is not available */}
          {permissionError && !stream && !audioUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-90 p-4 text-center">
              <div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 mx-auto mb-2 text-red-500"
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
                <p className="text-sm text-gray-700">{permissionError}</p>
                <button
                  type="button"
                  onClick={startMicrophone}
                  className="mt-2 px-3 py-1 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Show placeholder if no stream or audio */}
          {!stream && !audioUrl && !isInitializingMic && !permissionError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 mx-auto mb-2 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
                <p className="text-sm text-gray-500">
                  Click 'Start Recording' to begin
                </p>
              </div>
            </div>
          )}

          {/* Audio controls for playback */}
          {audioUrl && !isRecording && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                onClick={togglePlayPause}
                className="p-2 bg-white rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              >
                {isPlaying ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-gray-700"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-gray-700"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
              </button>
            </div>
          )}

          {/* Recording indicator */}
          {isRecording && (
            <div className="absolute top-2 right-2 flex items-center bg-white bg-opacity-90 text-gray-700 px-2 py-1 rounded-md text-xs">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse mr-1"></span>
              <span>{formatDuration(recordingDuration)}</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-t border-gray-300">
          <div>
            {/* Start Microphone button - shown if no stream and no audio */}
            {!stream && !audioUrl && !isInitializingMic && (
              <button
                type="button"
                onClick={startMicrophone}
                disabled={disabled || !isRecorderAvailable || isInitializingMic}
                className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
              >
                Start Recording
              </button>
            )}

            {/* Recording controls - shown if stream is active */}
            {stream && !audioUrl && (
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

            {/* Re-record button - shown if audio is recorded */}
            {audioUrl && (
              <button
                type="button"
                onClick={startMicrophone}
                disabled={disabled || !isRecorderAvailable || isInitializingMic}
                className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
              >
                Record New Audio
              </button>
            )}
          </div>

          <div>
            {/* Stop microphone button - shown if stream is active */}
            {stream && (
              <button
                type="button"
                onClick={stopMicrophone}
                className="ml-2 text-sm text-gray-600 hover:text-gray-800 focus:outline-none focus:underline"
              >
                Cancel
              </button>
            )}

            {/* Clear audio button - shown if audio is recorded */}
            {audioUrl && (
              <button
                type="button"
                onClick={clearAudio}
                className="ml-2 text-sm text-red-600 hover:text-red-800 focus:outline-none focus:underline"
              >
                Clear Audio
              </button>
            )}
          </div>
        </div>
      </div>

      {/* File info - shown if audio is recorded */}
      {audioBlob && (
        <div className="mt-1 text-xs text-gray-500">
          Size: {formatFileSize(audioBlob.size)} | Duration:{" "}
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

export default AudioRecorderInput;

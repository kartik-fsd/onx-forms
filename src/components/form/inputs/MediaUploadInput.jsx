import { useState, useRef, useEffect } from "preact/hooks";
import { MediaDAO } from "../../../db";
import { formatFileSize } from "../../../utils/helper";

const MediaUploadInput = ({
  id,
  name,
  label,
  value = null,
  onChange,
  accept = "image/*,video/*,audio/*,application/pdf",
  maxSize = 50 * 1024 * 1024, // 50MB default limit
  required = false,
  disabled = false,
  error,
  hint,
  className = "",
  ...props
}) => {
  const [filePreview, setFilePreview] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Initialize with existing value
  useEffect(() => {
    if (value && typeof value === "object") {
      if (value.dataUrl) {
        setFilePreview(value.dataUrl);
      }
      if (value.fileInfo) {
        setFileInfo(value.fileInfo);
      }
    }
  }, [value]);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Clear any previous errors
    setUploadError(null);

    // Check file size
    if (file.size > maxSize) {
      setUploadError(
        `File is too large. Maximum size is ${formatFileSize(maxSize)}.`
      );
      return;
    }

    try {
      setIsUploading(true);

      // Create file info object
      const fileInfoObj = {
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
      };

      // Generate preview for images and videos
      let preview = null;
      if (file.type.startsWith("image/")) {
        preview = await createImagePreview(file);
      } else if (file.type.startsWith("video/")) {
        preview = "/icons/video-icon.png"; // Use a placeholder icon for videos
      } else if (file.type.startsWith("audio/")) {
        preview = "/icons/audio-icon.png"; // Use a placeholder icon for audio
      } else {
        preview = "/icons/file-icon.png"; // Generic file icon for other types
      }

      // Store the media file in IndexedDB
      const mediaData = {
        fieldName: name,
        type: file.type,
        data: file,
        timestamp: new Date().toISOString(),
      };

      const mediaId = await MediaDAO.saveMedia(mediaData);

      // Update state
      setFilePreview(preview);
      setFileInfo(fileInfoObj);

      // Notify parent component
      onChange({
        mediaId,
        fileInfo: fileInfoObj,
        dataUrl: preview,
        timestamp: mediaData.timestamp,
      });
    } catch (error) {
      console.error("Error processing file:", error);
      setUploadError("Failed to process file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const createImagePreview = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveFile = () => {
    setFilePreview(null);
    setFileInfo(null);
    onChange(null);

    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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

      {/* File preview */}
      {filePreview && fileInfo && (
        <div className="mb-4 relative">
          <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
            <div className="flex items-start">
              {/* Preview image for images */}
              {fileInfo.type.startsWith("image/") && (
                <img
                  src={filePreview}
                  alt="Preview"
                  className="w-16 h-16 object-cover rounded mr-3"
                />
              )}

              {/* Icon for other file types */}
              {!fileInfo.type.startsWith("image/") && (
                <div className="w-16 h-16 flex items-center justify-center bg-gray-200 rounded mr-3">
                  {fileInfo.type.startsWith("video/") && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-8 w-8 text-gray-500"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                    </svg>
                  )}
                  {fileInfo.type.startsWith("audio/") && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-8 w-8 text-gray-500"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {!fileInfo.type.startsWith("video/") &&
                    !fileInfo.type.startsWith("audio/") && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-8 w-8 text-gray-500"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                </div>
              )}

              {/* File info */}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {fileInfo.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(fileInfo.size)}
                </p>
                <p className="text-xs text-gray-500">{fileInfo.type}</p>
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={handleRemoveFile}
                className="text-red-600 hover:text-red-800"
                aria-label="Remove file"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload button */}
      {(!filePreview || !fileInfo) && (
        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
          <div className="space-y-1 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="flex text-sm text-gray-600">
              <label
                htmlFor={id}
                className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
              >
                <span>{isUploading ? "Uploading..." : "Upload a file"}</span>
                <input
                  id={id}
                  name={name}
                  type="file"
                  ref={fileInputRef}
                  accept={accept}
                  onChange={handleFileSelect}
                  disabled={disabled || isUploading}
                  required={required && !value}
                  className="sr-only"
                  {...props}
                />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-gray-500">
              {accept
                .split(",")
                .map((type) => type.replace("*", ""))
                .join(", ")}{" "}
              up to {formatFileSize(maxSize)}
            </p>
          </div>
        </div>
      )}

      {/* Error message */}
      {(error || uploadError || hint) && (
        <p
          id={`${id}-description`}
          className={`mt-1 text-sm ${
            error || uploadError ? "text-red-600" : "text-gray-500"
          }`}
        >
          {error || uploadError || hint}
        </p>
      )}
    </div>
  );
};

export default MediaUploadInput;

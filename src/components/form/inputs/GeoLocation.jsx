import { useState, useEffect } from "preact/hooks";

const GeolocationInput = ({
  id,
  name,
  label,
  value = null,
  onChange,
  required = false,
  disabled = false,
  error,
  hint,
  className = "",
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [geolocationError, setGeolocationError] = useState(null);
  const [hasLocation, setHasLocation] = useState(!!value);

  // Initialize with existing value if available
  useEffect(() => {
    if (value && typeof value === "object") {
      setHasLocation(true);
    }
  }, [value]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGeolocationError("Geolocation is not supported by your browser");
      return;
    }

    setIsLoading(true);
    setGeolocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString(),
        };

        onChange(locationData);
        setHasLocation(true);
        setIsLoading(false);
      },
      (error) => {
        let errorMessage = "Unable to retrieve your location";

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage =
              "Location access was denied. Please grant permission to use this feature.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage =
              "Location information is unavailable. Please try again.";
            break;
          case error.TIMEOUT:
            errorMessage =
              "The request to get your location timed out. Please try again.";
            break;
        }

        setGeolocationError(errorMessage);
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleClearLocation = () => {
    onChange(null);
    setHasLocation(false);
  };

  const formatCoordinates = (coords) => {
    if (!coords || !coords.latitude || !coords.longitude)
      return "No coordinates";

    return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
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

      {/* Location display when available */}
      {hasLocation && value && (
        <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-700">
                Current Location:
              </p>
              <p className="text-sm text-gray-600">
                {formatCoordinates(value)}
              </p>
              {value && value.accuracy && (
                <p className="text-xs text-gray-500 mt-1">
                  Accuracy: ±{Math.round(value.accuracy)} meters
                </p>
              )}
              {value && value.timestamp && (
                <p className="text-xs text-gray-500">
                  Captured: {new Date(value.timestamp).toLocaleString()}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleClearLocation}
              className="text-red-600 hover:text-red-800 text-sm"
              aria-label="Clear location"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Get location button */}
      <button
        type="button"
        onClick={handleGetLocation}
        disabled={disabled || isLoading}
        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <span className="animate-spin h-4 w-4 mr-2 border-b-2 border-white rounded-full"></span>
            Getting Location...
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
                d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                clip-rule="evenodd"
              />
            </svg>
            {hasLocation ? "Update Location" : "Get Current Location"}
          </>
        )}
      </button>

      {/* Error messages */}
      {(error || geolocationError || hint) && (
        <p
          id={`${id}-description`}
          className={`mt-2 text-sm ${
            error || geolocationError ? "text-red-600" : "text-gray-500"
          }`}
        >
          {error || geolocationError || hint}
        </p>
      )}
    </div>
  );
};

export default GeolocationInput;

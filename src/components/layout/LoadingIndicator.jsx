/**
 * Loading indicator component with customizable size and message
 */
const LoadingIndicator = ({
  message = "Loading...",
  size = "medium",
  className = "",
}) => {
  // Determine spinner size
  const spinnerSizes = {
    small: "h-4 w-4",
    medium: "h-8 w-8",
    large: "h-12 w-12",
  };

  const spinnerSize = spinnerSizes[size] || spinnerSizes.medium;

  return (
    <div
      className={`flex flex-col items-center justify-center p-4 ${className}`}
    >
      {/* Spinner */}
      <div
        className={`animate-spin ${spinnerSize} rounded-full border-t-2 border-b-2 border-blue-500 mb-3`}
      ></div>

      {/* Message */}
      {message && <p className="text-gray-600">{message}</p>}
    </div>
  );
};

export default LoadingIndicator;

/**
 * Success message display component
 */
const SuccessDisplay = ({
  title = "Success",
  message,
  buttonText,
  onButtonClick,
  isInline = false,
  className = "",
}) => {
  // Determine container style based on isInline prop
  const containerClass = isInline
    ? `p-4 rounded-md border ${className}`
    : `max-w-md mx-auto bg-white p-6 rounded-lg shadow-md text-center ${className}`;

  return (
    <div className={containerClass}>
      {/* Success icon */}
      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
        <svg
          className="h-8 w-8 text-green-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      {/* Success content */}
      <h2 className="text-lg font-medium text-gray-900 mb-2">{title}</h2>

      {message && <p className="text-sm text-gray-600 mb-4">{message}</p>}

      {/* Action button */}
      {buttonText && onButtonClick && (
        <button
          onClick={onButtonClick}
          className="inline-flex justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          {buttonText}
        </button>
      )}
    </div>
  );
};

export default SuccessDisplay;

const ToggleInput = ({
  id,
  name,
  label,
  value = false,
  onChange,
  required = false,
  disabled = false,
  error,
  hint,
  className = "",
  ...props
}) => {
  const handleChange = (e) => {
    onChange(e.target.checked);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center">
        <label
          htmlFor={id}
          className="block text-sm font-medium text-gray-700 mr-3"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>

        <label className="relative inline-flex items-center cursor-pointer">
          <input
            id={id}
            name={name}
            type="checkbox"
            checked={value}
            onChange={handleChange}
            disabled={disabled}
            required={required}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={hint || error ? `${id}-description` : undefined}
            className="sr-only"
            {...props}
          />
          <div
            className={`w-11 h-6 bg-gray-200 rounded-full peer 
            ${
              disabled
                ? "opacity-50"
                : "peer-focus:ring-2 peer-focus:ring-blue-300"
            } 
            ${value ? "after:translate-x-5 bg-blue-600" : "after:translate-x-1"}
            after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
            after:bg-white after:border after:rounded-full after:h-5 after:w-5 
            after:transition-all peer-checked:bg-blue-600`}
          ></div>
        </label>
      </div>

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

export default ToggleInput;

const CheckboxInput = ({
  id,
  name,
  label,
  options = [],
  value = [],
  onChange,
  required = false,
  disabled = false,
  error,
  hint,
  className = "",
  ...props
}) => {
  // Ensure value is always an array
  const selectedValues = Array.isArray(value) ? value : value ? [value] : [];

  const handleChange = (optionValue, checked) => {
    if (checked) {
      // Add the value if it's not already selected
      if (!selectedValues.includes(optionValue)) {
        onChange([...selectedValues, optionValue]);
      }
    } else {
      // Remove the value
      onChange(selectedValues.filter((val) => val !== optionValue));
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex flex-col">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>

        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={`${id}-${index}`} className="flex items-center">
              <input
                id={`${id}-${index}`}
                name={name}
                type="checkbox"
                value={option.value}
                checked={selectedValues.includes(option.value)}
                onChange={(e) => handleChange(option.value, e.target.checked)}
                disabled={disabled || option.disabled}
                required={required && index === 0}
                aria-invalid={error ? "true" : "false"}
                aria-describedby={
                  hint || error ? `${id}-description` : undefined
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                {...props}
              />
              <label
                htmlFor={`${id}-${index}`}
                className="ml-2 block text-sm text-gray-700"
              >
                {option.label}
              </label>
            </div>
          ))}
        </div>
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

export default CheckboxInput;

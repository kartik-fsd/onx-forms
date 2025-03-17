const SelectInput = ({
  id,
  name,
  label,
  options = [],
  value = "",
  onChange,
  placeholder = "Select an option",
  required = false,
  disabled = false,
  error,
  hint,
  className = "",
  ...props
}) => {
  const handleChange = (e) => {
    onChange(e.target.value);
  };

  return (
    <div className={`relative ${className}`}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        <select
          id={id}
          name={name}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={hint || error ? `${id}-description` : undefined}
          className={`block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md appearance-none bg-white disabled:bg-gray-100 disabled:text-gray-500 
            ${error ? "border-red-500" : "border-gray-300"}`}
          {...props}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
          <svg
            className="h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
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

export default SelectInput;

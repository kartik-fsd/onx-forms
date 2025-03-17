
const TextInput = ({
  id,
  name,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  error,
  hint,
  className = '',
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
      
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={hint || error ? `${id}-description` : undefined}
        className={`w-full px-4 py-2 border rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 
          ${error ? 'border-red-500' : 'border-gray-300'}`}
        {...props}
      />
      
      {/* Error message or hint */}
      {(error || hint) && (
        <p 
          id={`${id}-description`} 
          className={`mt-1 text-sm ${error ? 'text-red-600' : 'text-gray-500'}`}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
};

export default TextInput;
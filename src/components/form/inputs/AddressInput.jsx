import { useState, useEffect } from "preact/hooks";
import TextInput from "./TextInput";

const AddressInput = ({
  id,
  name,
  label,
  value = {},
  onChange,
  required = false,
  disabled = false,
  error,
  hint,
  className = "",
  ...props
}) => {
  // Ensure value is an object
  const [address, setAddress] = useState({
    street: "",
    city: "",
    state: "",
    zip: "",
    country: "",
    ...value,
  });

  // Update parent when address changes
  useEffect(() => {
    onChange(address);
  }, [address, onChange]);

  // Update address field
  const updateField = (field, value) => {
    setAddress((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Derive field-specific errors from the main error
  const getFieldError = (field) => {
    if (!error) return null;

    // If error is a string, show it only on the first field
    if (typeof error === "string") {
      return field === "street" ? error : null;
    }

    // If error is an object, get the field-specific error
    return error[field] || null;
  };

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="space-y-4">
        <TextInput
          id={`${id}-street`}
          name={`${name}-street`}
          label="Street Address"
          value={address.street}
          onChange={(value) => updateField("street", value)}
          placeholder="Street address, building, apt, etc."
          required={required}
          disabled={disabled}
          error={getFieldError("street")}
          className="mb-3"
        />

        <div className="grid grid-cols-2 gap-4">
          <TextInput
            id={`${id}-city`}
            name={`${name}-city`}
            label="City"
            value={address.city}
            onChange={(value) => updateField("city", value)}
            placeholder="City"
            required={required}
            disabled={disabled}
            error={getFieldError("city")}
          />

          <TextInput
            id={`${id}-state`}
            name={`${name}-state`}
            label="State/Province"
            value={address.state}
            onChange={(value) => updateField("state", value)}
            placeholder="State or province"
            required={required}
            disabled={disabled}
            error={getFieldError("state")}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <TextInput
            id={`${id}-zip`}
            name={`${name}-zip`}
            label="ZIP/Postal Code"
            value={address.zip}
            onChange={(value) => updateField("zip", value)}
            placeholder="ZIP or postal code"
            required={required}
            disabled={disabled}
            error={getFieldError("zip")}
          />

          <TextInput
            id={`${id}-country`}
            name={`${name}-country`}
            label="Country"
            value={address.country}
            onChange={(value) => updateField("country", value)}
            placeholder="Country"
            required={required}
            disabled={disabled}
            error={getFieldError("country")}
          />
        </div>
      </div>

      {/* Overall hint */}
      {hint && !error && (
        <p id={`${id}-description`} className="mt-1 text-sm text-gray-500">
          {hint}
        </p>
      )}
    </div>
  );
};

export default AddressInput;

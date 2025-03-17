// Built-in validation rules
const rules = {
    // Required field
    required: (value) => {
        if (Array.isArray(value)) {
            return value.length > 0 ? null : 'This field is required';
        }

        if (value === undefined || value === null) {
            return 'This field is required';
        }

        if (typeof value === 'string') {
            return value.trim() !== '' ? null : 'This field is required';
        }

        if (typeof value === 'object') {
            return Object.keys(value).length > 0 ? null : 'This field is required';
        }

        return null; // Valid for other types
    },

    // Minimum length
    minLength: (value, min) => {
        if (!value || typeof value !== 'string') return null;
        return value.length >= min ? null : `Must be at least ${min} characters`;
    },

    // Maximum length
    maxLength: (value, max) => {
        if (!value || typeof value !== 'string') return null;
        return value.length <= max ? null : `Must be no more than ${max} characters`;
    },

    // Minimum value (for numbers)
    min: (value, min) => {
        if (value === undefined || value === null || value === '') return null;
        const numValue = Number(value);
        return !isNaN(numValue) && numValue >= min ? null : `Must be at least ${min}`;
    },

    // Maximum value (for numbers)
    max: (value, max) => {
        if (value === undefined || value === null || value === '') return null;
        const numValue = Number(value);
        return !isNaN(numValue) && numValue <= max ? null : `Must be no more than ${max}`;
    },

    // Email format
    email: (value) => {
        if (!value) return null;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value) ? null : 'Please enter a valid email address';
    },

    // Phone number format
    phone: (value) => {
        if (!value) return null;
        // Basic international phone validation (can be made more specific per region)
        const phoneRegex = /^\+?[0-9\s\-()]{8,20}$/;
        return phoneRegex.test(value) ? null : 'Please enter a valid phone number';
    },

    // URL format
    url: (value) => {
        if (!value) return null;
        try {
            new URL(value);
            return null;
        } catch (e) {
            return 'Please enter a valid URL';
        }
    },

    // Regular expression match
    pattern: (value, pattern, message = 'Invalid format') => {
        if (!value) return null;
        const regex = new RegExp(pattern);
        return regex.test(value) ? null : message;
    },

    // Match another field
    matches: (value, targetValue, message = 'Fields do not match') => {
        return value === targetValue ? null : message;
    },

    // Date validation
    date: (value) => {
        if (!value) return null;
        const date = new Date(value);
        return !isNaN(date.getTime()) ? null : 'Please enter a valid date';
    },

    // Future date
    futureDate: (value) => {
        if (!value) return null;
        const date = new Date(value);
        if (isNaN(date.getTime())) return 'Please enter a valid date';
        return date > new Date() ? null : 'Date must be in the future';
    },

    // Past date
    pastDate: (value) => {
        if (!value) return null;
        const date = new Date(value);
        if (isNaN(date.getTime())) return 'Please enter a valid date';
        return date < new Date() ? null : 'Date must be in the past';
    },

    // Custom validator function
    custom: (value, validatorFn) => {
        if (typeof validatorFn !== 'function') {
            console.error('Custom validator is not a function');
            return null;
        }

        return validatorFn(value);
    }
};

// Parse validation schema from form definition
function parseValidation(validationDef, allValues = {}) {
    if (!validationDef) return [];
}

// Validate a single field
function validateField(value, validationRules, allValues = {}) {
    if (!validationRules || !validationRules.length) {
        return null; // No validation rules, field is valid
    }

    // Parse validation rules if needed
    const parsedRules = Array.isArray(validationRules)
        ? validationRules
        : parseValidation(validationRules, allValues);

    // Apply each rule in order
    for (const rule of parsedRules) {
        if (!rule || !rule.name) continue;

        const validatorFn = rules[rule.name];
        if (!validatorFn) {
            console.warn(`Unknown validation rule: ${rule.name}`);
            continue;
        }

        const error = validatorFn(value, ...rule.params);
        if (error) {
            return error; // Return the first error
        }
    }

    return null; // Field is valid
}

// Validate entire form
function validateForm(formData, formSchema, options = {}) {
    const { abortEarly = false } = options;
    const errors = {};
    let isValid = true;

    // Get form fields from schema
    const fields = formSchema.fields || [];

    // Validate each field
    for (const field of fields) {
        const { name, validation, required } = field;

        // Skip validation if no rules and not required
        if (!validation && !required) continue;

        // Build validation rules
        let fieldRules = validation ? parseValidation(validation, formData) : [];

        // Add required rule if specified
        if (required && !fieldRules.some(rule => rule && rule.name === 'required')) {
            fieldRules = [{ name: 'required', params: [] }, ...fieldRules];
        }

        // Validate field
        const value = formData[name];
        const error = validateField(value, fieldRules, formData);

        if (error) {
            errors[name] = error;
            isValid = false;

            // Abort early if requested
            if (abortEarly) break;
        }
    }

    return {
        isValid,
        errors
    };
}

// Validate form step
function validateStep(formData, stepSchema, options = {}) {
    // Create temporary form schema with only fields from this step
    const tempSchema = {
        fields: stepSchema.fields || []
    };

    return validateForm(formData, tempSchema, options);
}

// Add custom validation rule
function addValidationRule(name, validatorFn) {
    if (rules[name]) {
        console.warn(`Overriding existing validation rule: ${name}`);
    }

    rules[name] = validatorFn;
}

// Export validation functionality
export default {
    rules,
    validateField,
    validateForm,
    validateStep,
    addValidationRule
};
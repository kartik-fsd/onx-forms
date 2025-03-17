import { useEffect, useState } from "preact/hooks";
import { useForm } from "../../context/FormContext";
import FormStepper from "./stepper/FormStepper";
import TextInput from "./inputs/TextInput";
import ToggleInput from "./inputs/ToggleInput";
import RadioInput from "./inputs/RadioInput";
import CheckboxInput from "./inputs/CheckboxInput";
import SelectInput from "./inputs/SelectInput";
import ImageCaptureInput from "./inputs/ImageCaptureInput";
import MediaUploadInput from "./inputs/MediaUploadInput";
import AddressInput from "./inputs/AddressInput";
import GeolocationInput from "./inputs/GeoLocation";

const FormRenderer = ({ formDefinition, draftId = null }) => {
  const {
    initForm,
    loadDraft,
    currentStep,
    setStep,
    formData,
    updateField,
    saveDraft,
    submitForm,
    lastSaved,
    error,
    clearError,
    isSubmitting,
    isSaving,
    isLoading,
  } = useForm();

  const [formSubmitted, setFormSubmitted] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  // Initialize form or load draft
  useEffect(() => {
    if (formDefinition) {
      if (draftId) {
        loadDraft(draftId);
      } else {
        initForm(
          formDefinition.id,
          formDefinition.projectId,
          formDefinition.steps.length
        );
      }
    }
  }, [formDefinition, draftId, initForm, loadDraft]);

  // Handle validation for the current step
  const validateCurrentStep = () => {
    const currentStepFields = formDefinition.steps[currentStep].fields;
    const errors = {};
    let isValid = true;

    currentStepFields.forEach((field) => {
      // Skip validation if field is not required
      if (!field.required) return;

      const value = formData[field.name];

      // Check if value is empty
      if (value === undefined || value === null || value === "") {
        errors[field.name] = `${field.label} is required`;
        isValid = false;
      }

      // Additional validations based on field type
      if (field.type === "email" && value && !/^\S+@\S+\.\S+$/.test(value)) {
        errors[field.name] = "Please enter a valid email address";
        isValid = false;
      }

      if (field.type === "tel" && value && !/^\d{10,15}$/.test(value)) {
        errors[field.name] = "Please enter a valid phone number";
        isValid = false;
      }

      // Custom validation if provided
      if (field.validation && value) {
        const pattern = new RegExp(field.validation.pattern);
        if (!pattern.test(value)) {
          errors[field.name] = field.validation.message || "Invalid input";
          isValid = false;
        }
      }
    });

    setValidationErrors(errors);
    return isValid;
  };

  // Handle next step
  const handleNext = () => {
    if (validateCurrentStep()) {
      if (currentStep < formDefinition.steps.length - 1) {
        setStep(currentStep + 1);
      }
    }
  };

  // Handle previous step
  const handlePrev = () => {
    if (currentStep > 0) {
      setStep(currentStep - 1);
    }
  };

  // Handle manual save
  const handleSave = async () => {
    await saveDraft();
  };

  // Handle submit
  const handleSubmit = async () => {
    if (validateCurrentStep()) {
      const formDataId = await submitForm();
      if (formDataId) {
        setFormSubmitted(true);
      }
    }
  };

  // Render field based on its type
  const renderField = (field) => {
    const props = {
      id: field.name,
      name: field.name,
      label: field.label,
      value: formData[field.name] || "",
      onChange: (value) => updateField(field.name, value),
      required: field.required,
      placeholder: field.placeholder,
      hint: field.hint,
      error: validationErrors[field.name],
      disabled: isSubmitting,
      ...field.props,
    };

    switch (field.type) {
      case "text":
      case "email":
      case "tel":
      case "number":
      case "date":
        return <TextInput {...props} type={field.type} />;

      case "toggle":
        return <ToggleInput {...props} />;

      case "radio":
        return <RadioInput {...props} options={field.options} />;

      case "checkbox":
        return <CheckboxInput {...props} options={field.options} />;

      case "select":
        return <SelectInput {...props} options={field.options} />;

      case "image-capture":
        return <ImageCaptureInput {...props} />;

      case "media-upload":
        return <MediaUploadInput {...props} accept={field.accept} />;

      case "address":
        return <AddressInput {...props} />;

      case "geolocation":
        return <GeolocationInput {...props} />;

      default:
        return <TextInput {...props} />;
    }
  };

  // If loading, show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If form is submitted, show success message
  if (formSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 mb-4 flex items-center justify-center rounded-full bg-green-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 text-green-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Form Submitted Successfully!
        </h2>
        <p className="text-gray-600 mb-6">
          Your information has been recorded.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
        >
          Complete Another Form
        </button>
      </div>
    );
  }

  // Render the form
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Form header */}
      <div className="bg-gray-50 px-6 py-4 border-b">
        <h1 className="text-xl font-semibold text-gray-800">
          {formDefinition.title}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {formDefinition.description}
        </p>
      </div>

      {/* Form content */}
      <div className="p-6">
        {/* Stepper */}
        <FormStepper steps={formDefinition.steps} />

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-red-400 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clip-rule="evenodd"
                />
              </svg>
              <span className="text-red-700">{error}</span>
            </div>
            <button
              className="mt-2 text-red-600 text-sm hover:underline focus:outline-none"
              onClick={clearError}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Last saved message */}
        {lastSaved && (
          <div className="mb-6 text-sm text-gray-500 flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
            </svg>
            <span>Last saved: {new Date(lastSaved).toLocaleString()}</span>
          </div>
        )}

        {/* Current step fields */}
        <div>
          <h2 className="text-lg font-medium text-gray-800 mb-4">
            {formDefinition.steps[currentStep].title}
          </h2>
          {formDefinition.steps[currentStep].description && (
            <p className="text-sm text-gray-600 mb-6">
              {formDefinition.steps[currentStep].description}
            </p>
          )}

          <div className="space-y-6">
            {formDefinition.steps[currentStep].fields.map((field) => (
              <div key={field.name} className="form-field">
                {renderField(field)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form footer with actions */}
      <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
        {/* Navigation buttons */}
        <div>
          {currentStep > 0 && (
            <button
              type="button"
              onClick={handlePrev}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 mr-2 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
            >
              Previous
            </button>
          )}

          {currentStep < formDefinition.steps.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:opacity-50 flex items-center"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin h-4 w-4 mr-2 border-b-2 border-white rounded-full"></span>
                  Submitting...
                </>
              ) : (
                "Submit"
              )}
            </button>
          )}
        </div>

        {/* Save draft button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSubmitting || isSaving}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 flex items-center"
        >
          {isSaving ? (
            <>
              <span className="animate-spin h-4 w-4 mr-2 border-b-2 border-gray-600 rounded-full"></span>
              Saving...
            </>
          ) : (
            "Save Draft"
          )}
        </button>
      </div>

      {/* Offline indicator */}
      <div
        id="offline-indicator"
        className="hidden fixed bottom-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded-md shadow-lg"
      >
        You are currently offline. Your data will be saved and synced when
        you're back online.
      </div>
    </div>
  );
};

export default FormRenderer;

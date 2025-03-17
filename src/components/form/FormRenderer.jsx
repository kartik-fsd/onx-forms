import { useState, useEffect, useMemo } from "preact/hooks";
import { route } from "preact-router";
import FormStepper from "./stepper/FormStepper";
import FormStep from "./stepper/FormStepper";
import FormNavigation from "./FormNavigation";
import LoadingIndicator from "../layout/LoadingIndicator";
import ErrorDisplay from "../layout/ErrorDisplay";
import SuccessDisplay from "../common/SuccessDisplay";
import formTemplateService from "../../services/formTemplateService";
import formDataService from "../../services/formDataService";
import syncService from "../../services/syncService";
import validator from "../../utils/validation";
import { useOfflineStatus } from "../../hooks/useOfflineStatus";
import { useAutoSave } from "../../hooks/useAutoSave";

const FormRenderer = ({
  formId,
  draftId = null,
  apiUrl = process.env.API_URL || "",
}) => {
  // State management
  const [formTemplate, setFormTemplate] = useState(null);
  const [formData, setFormData] = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Custom hooks
  const { isOffline, wasOffline } = useOfflineStatus();

  // Auto-save functionality
  const { isSaving, lastAutoSave, triggerSave } = useAutoSave({
    data: formData,
    saveFunction: async (data) => {
      if (!formTemplate || !formTemplate.id) return null;

      try {
        const saveData = {
          formId: formTemplate.id,
          data,
          currentStep,
          updatedAt: new Date().toISOString(),
        };

        if (draftId) {
          saveData.id = draftId;
        }

        const savedId = await formDataService.saveDraft(saveData);
        setLastSaved(new Date().toISOString());
        setIsDraft(true);

        if (!draftId && savedId) {
          // Update URL to include draft ID for new drafts
          route(
            `/form/${formTemplate.projectId}/${formTemplate.id}/draft/${savedId}`,
            true
          );
        }

        return savedId;
      } catch (err) {
        console.error("Error auto-saving form:", err);
        return null;
      }
    },
    debounceMs: 2000, // Auto-save after 2 seconds of inactivity
    enabled: !!formTemplate,
  });

  // Process the form template with conditional logic applied
  const processedTemplate = useMemo(() => {
    if (!formTemplate) return null;
    return formTemplateService.processTemplate(formTemplate, formData);
  }, [formTemplate, formData]);

  // Load form template and draft if available
  useEffect(() => {
    async function loadFormAndData() {
      try {
        setLoading(true);
        setError(null);

        // Load the form template
        const template = await formTemplateService.getOrFetchFormTemplate(
          formId,
          apiUrl
        );

        if (!template) {
          throw new Error(`Form template with ID ${formId} not found`);
        }

        setFormTemplate(template);

        // If we have a draft ID, load the draft
        if (draftId) {
          const draft = await formDataService.getDraft(draftId);

          if (draft) {
            setFormData(draft.data || {});
            setCurrentStep(draft.currentStep || 0);
            setLastSaved(draft.updatedAt);
            setIsDraft(true);
          } else {
            console.warn(
              `Draft with ID ${draftId} not found, starting with empty form`
            );
          }
        }
      } catch (err) {
        console.error("Error loading form:", err);
        setError(err.message || "Failed to load form. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadFormAndData();
  }, [formId, draftId, apiUrl]);

  // Handle field change
  const handleFieldChange = (name, value) => {
    setFormData((prevData) => {
      const newData = { ...prevData, [name]: value };

      // Clear validation error for this field if it exists
      if (validationErrors[name]) {
        setValidationErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }

      return newData;
    });
  };

  // Validate current step
  const validateCurrentStep = () => {
    if (!processedTemplate || !processedTemplate.steps[currentStep]) {
      return { isValid: false, errors: { _form: "Invalid form step" } };
    }

    const stepSchema = processedTemplate.steps[currentStep];
    const result = validator.validateStep(formData, stepSchema);

    setValidationErrors(result.errors);
    return result;
  };

  // Handle next step
  const handleNextStep = () => {
    const { isValid } = validateCurrentStep();

    if (isValid) {
      if (currentStep < (processedTemplate?.steps.length - 1 || 0)) {
        setCurrentStep((prev) => prev + 1);
        window.scrollTo(0, 0);
      }
    }
  };

  // Handle previous step
  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  // Save draft manually
  const handleSaveDraft = async () => {
    try {
      const savedId = await triggerSave(formData);

      if (savedId) {
        alert("Draft saved successfully");
      }
    } catch (err) {
      console.error("Error saving draft:", err);
      setError("Failed to save draft. Please try again.");
    }
  };

  // Submit form
  const handleSubmit = async () => {
    const { isValid, errors } = validateCurrentStep();

    if (!isValid) {
      setValidationErrors(errors);
      return;
    }

    try {
      setIsSubmitting(true);

      // Create submission data
      const submissionData = {
        formId: formTemplate.id,
        projectId: formTemplate.projectId,
        data: formData,
        createdAt: new Date().toISOString(),
        version: formTemplate.version,
      };

      // Submit the form
      const result = await formDataService.submitForm(submissionData);

      // If we were working with a draft, delete it
      if (draftId) {
        await formDataService.deleteDraft(draftId);
      }

      // Mark as submitted
      setFormSubmitted(true);
      setIsDraft(false);

      // Trigger sync if online
      if (!isOffline) {
        syncService.triggerSync();
      }

      return result;
    } catch (err) {
      console.error("Error submitting form:", err);
      setError(
        "Failed to submit form. " +
          (isOffline
            ? "Your data has been saved locally and will be submitted when you are online."
            : "Please try again.")
      );

      // Save as draft if submission fails
      await handleSaveDraft();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clear error
  const clearError = () => {
    setError(null);
  };

  // Start a new form
  const handleStartNewForm = () => {
    route(`/form/${formTemplate.projectId}/${formTemplate.id}`);
    window.location.reload(); // Ensure clean state
  };

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <LoadingIndicator message="Loading form..." />
      </div>
    );
  }

  // Error state
  if (error && !formTemplate) {
    return (
      <div className="container mx-auto p-4">
        <ErrorDisplay
          title="Error Loading Form"
          message={error}
          onRetry={() => window.location.reload()}
          onBack={() => route("/")}
        />
      </div>
    );
  }

  // No template found
  if (!formTemplate) {
    return (
      <div className="container mx-auto p-4">
        <ErrorDisplay
          title="Form Not Found"
          message="The form you're looking for doesn't exist or has been removed."
          onBack={() => route("/")}
        />
      </div>
    );
  }

  // Form submitted successfully
  if (formSubmitted) {
    return (
      <div className="container mx-auto p-4">
        <SuccessDisplay
          title="Form Submitted Successfully"
          message="Thank you! Your information has been submitted."
          buttonText="Complete Another Form"
          onButtonClick={handleStartNewForm}
        />
      </div>
    );
  }

  // Current step
  const currentStepData = processedTemplate?.steps[currentStep];

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Form header */}
        <div className="bg-gray-50 px-6 py-4 border-b">
          <h1 className="text-xl font-semibold text-gray-800">
            {formTemplate.title}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {formTemplate.description}
          </p>

          {/* Offline indicator */}
          {isOffline && (
            <div className="mt-2 text-sm bg-yellow-50 text-yellow-800 p-2 rounded border border-yellow-200">
              You are currently offline. Your data will be saved locally and
              submitted when you're back online.
            </div>
          )}

          {/* Recently came back online indicator */}
          {!isOffline && wasOffline && (
            <div className="mt-2 text-sm bg-green-50 text-green-800 p-2 rounded border border-green-200">
              You are back online. Any saved data will be synchronized
              automatically.
            </div>
          )}
        </div>

        {/* Form content */}
        <div className="p-6">
          {/* Stepper */}
          {processedTemplate.steps.length > 1 && (
            <FormStepper
              steps={processedTemplate.steps}
              currentStep={currentStep}
              onChange={setCurrentStep}
              formData={formData}
            />
          )}

          {/* Error message */}
          {error && (
            <div className="mb-6">
              <ErrorDisplay message={error} onClose={clearError} />
            </div>
          )}

          {/* Last saved message */}
          {lastSaved && isDraft && (
            <div className="mb-4 flex items-center text-sm text-gray-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
                  clipRule="evenodd"
                />
              </svg>
              Last saved: {new Date(lastSaved).toLocaleString()}
              {isSaving && <span className="ml-2">(Saving...)</span>}
            </div>
          )}

          {/* Current step */}
          {currentStepData && (
            <div>
              <h2 className="text-lg font-medium text-gray-800 mb-4">
                {currentStepData.title}
              </h2>

              {currentStepData.description && (
                <p className="text-sm text-gray-600 mb-6">
                  {currentStepData.description}
                </p>
              )}

              <FormStep
                step={currentStepData}
                formData={formData}
                onChange={handleFieldChange}
                errors={validationErrors}
                disabled={isSubmitting}
              />
            </div>
          )}
        </div>

        {/* Form navigation */}
        <div className="px-6 py-4 bg-gray-50 border-t">
          <FormNavigation
            currentStep={currentStep}
            totalSteps={processedTemplate.steps.length}
            onPrevious={handlePreviousStep}
            onNext={handleNextStep}
            onSave={handleSaveDraft}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            isSaving={isSaving}
            isLastStep={currentStep === processedTemplate.steps.length - 1}
          />
        </div>
      </div>
    </div>
  );
};

export default FormRenderer;

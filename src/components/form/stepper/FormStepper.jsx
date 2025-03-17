import { useForm } from "../../../context/formContext";

const FormStepper = ({ steps, disableNavigation = false }) => {
  const { currentStep, setStep, formData } = useForm();

  // Function to check if a step is complete (has all required fields)
  const isStepComplete = (stepIndex) => {
    const step = steps[stepIndex];
    if (!step || !step.fields) return false;

    return step.fields.every((field) => {
      // Skip if not required
      if (!field.required) return true;

      // Check if the field has a value
      const value = formData[field.name];
      return value !== undefined && value !== null && value !== "";
    });
  };

  // Function to determine if user can navigate to a step
  const canNavigateToStep = (stepIndex) => {
    if (disableNavigation) return false;
    if (stepIndex === currentStep) return true; // Current step is always navigable
    if (stepIndex < currentStep) return true; // Previous steps are always navigable

    // For future steps, all previous steps must be complete
    for (let i = 0; i < stepIndex; i++) {
      if (!isStepComplete(i)) return false;
    }

    return true;
  };

  const handleStepClick = (index) => {
    if (canNavigateToStep(index)) {
      setStep(index);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={index} className="flex flex-col items-center w-full">
            <div
              className={`relative flex items-center justify-center w-10 h-10 rounded-full 
                ${
                  index === currentStep
                    ? "bg-blue-600 text-white"
                    : isStepComplete(index)
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-700"
                }
                ${
                  canNavigateToStep(index)
                    ? "cursor-pointer hover:opacity-80"
                    : "cursor-not-allowed opacity-50"
                }
                transition-all duration-200`}
              onClick={() => handleStepClick(index)}
              role={canNavigateToStep(index) ? "button" : "presentation"}
              aria-current={index === currentStep ? "step" : undefined}
              aria-label={`Step ${index + 1}: ${step.title}`}
            >
              {isStepComplete(index) ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-6 h-6"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              ) : (
                <span>{index + 1}</span>
              )}
            </div>

            {/* Line connector */}
            {index < steps.length - 1 && (
              <div className="w-full h-1 bg-gray-200 mt-5">
                <div
                  className={`h-full ${
                    isStepComplete(index) ? "bg-green-500" : "bg-gray-200"
                  }`}
                  style={{ width: `${isStepComplete(index) ? "100%" : "0%"}` }}
                />
              </div>
            )}

            <span className="mt-2 text-xs text-center">{step.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FormStepper;

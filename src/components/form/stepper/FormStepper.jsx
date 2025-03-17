import { lazy, Suspense } from "preact/compat";
import LoadingIndicator from "../../layout/LoadingIndicator";

// Import basic input components directly for quick loading
import TextInput from "../inputs/TextInput";
import RadioInput from "../inputs/RadioInput";
import CheckboxInput from "../inputs/CheckboxInput";
import SelectInput from "../inputs/SelectInput";
import ToggleInput from "../inputs/ToggleInput";

// Lazily load more complex components to improve initial load time
const MediaUploadInput = lazy(() => import("../inputs/MediaUploadInput"));
const ImageCaptureInput = lazy(() => import("../inputs/ImageCaptureInput"));
const VideoRecorderInput = lazy(() => import("../inputs/VideoRecorderInput"));
const AudioRecorderInput = lazy(() => import("../inputs/AudioRecorderInput"));
const GeoLocationInput = lazy(() => import("../inputs/GeoLocation"));
const AddressInput = lazy(() => import("../inputs/AddressInput"));
const SignatureInput = lazy(() => import("../inputs/SignatureInput"));

// Component to render a form step with all its fields
const FormStep = ({
  step,
  formData,
  onChange,
  errors = {},
  disabled = false,
}) => {
  // If no step provided, return null
  if (!step || !step.fields) {
    return null;
  }

  // Function to render the appropriate input component based on field type
  const renderField = (field) => {
    const {
      id,
      name,
      type,
      label,
      required,
      placeholder,
      hint,
      options,
      props = {},
    } = field;

    // Common props for all input types
    const commonProps = {
      id: id || name,
      name,
      label,
      value: formData[name] || "",
      onChange: (value) => onChange(name, value),
      error: errors[name],
      required,
      placeholder,
      hint,
      disabled,
      ...props,
    };

    // Render the appropriate component based on type
    switch (type) {
      case "text":
      case "email":
      case "tel":
      case "url":
      case "number":
      case "date":
        return <TextInput {...commonProps} type={type} />;

      case "textarea":
        return <TextInput {...commonProps} type="textarea" />;

      case "radio":
        return <RadioInput {...commonProps} options={options || []} />;

      case "checkbox":
        return <CheckboxInput {...commonProps} options={options || []} />;

      case "select":
        return <SelectInput {...commonProps} options={options || []} />;

      case "toggle":
        return <ToggleInput {...commonProps} />;

      // Complex components with lazy loading
      case "image-capture":
        return (
          <Suspense fallback={<LoadingIndicator size="small" />}>
            <ImageCaptureInput {...commonProps} />
          </Suspense>
        );

      case "video-recorder":
        return (
          <Suspense fallback={<LoadingIndicator size="small" />}>
            <VideoRecorderInput {...commonProps} />
          </Suspense>
        );

      case "audio-recorder":
        return (
          <Suspense fallback={<LoadingIndicator size="small" />}>
            <AudioRecorderInput {...commonProps} />
          </Suspense>
        );

      case "media-upload":
        return (
          <Suspense fallback={<LoadingIndicator size="small" />}>
            <MediaUploadInput {...commonProps} />
          </Suspense>
        );

      case "geolocation":
        return (
          <Suspense fallback={<LoadingIndicator size="small" />}>
            <GeoLocationInput {...commonProps} />
          </Suspense>
        );

      case "address":
        return (
          <Suspense fallback={<LoadingIndicator size="small" />}>
            <AddressInput {...commonProps} />
          </Suspense>
        );

      case "signature":
        return (
          <Suspense fallback={<LoadingIndicator size="small" />}>
            <SignatureInput {...commonProps} />
          </Suspense>
        );

      // Default to text input if type not recognized
      default:
        console.warn(
          `Unrecognized field type: ${type}, using text input as fallback`
        );
        return <TextInput {...commonProps} />;
    }
  };

  return (
    <div className="space-y-6">
      {step.fields.map((field, index) => (
        <div key={field.id || field.name || index} className="form-field">
          {renderField(field)}
        </div>
      ))}
    </div>
  );
};

export default FormStep;

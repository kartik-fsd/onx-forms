import { h } from "preact";
import { useState, useEffect } from "preact/hooks";
import FormRenderer from "../components/form/FormRenderer";
import { FormDAO } from "../db";
import { useForm } from "../context/FormContext";
import PropTypes from "prop-types";

const FormPage = ({ matches }) => {
  const { formId, draftId } = matches;
  const [formDefinition, setFormDefinition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  FormPage.propTypes = {
    matches: PropTypes.shape({
      formId: PropTypes.string.isRequired,
      draftId: PropTypes.string.isRequired,
    }).isRequired,
  };

  const { clearError } = useForm();

  // Clear any existing form errors when mounting
  useEffect(() => {
    clearError();
  }, [clearError]);

  // Fetch form definition
  useEffect(() => {
    const fetchForm = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch form definition from IndexedDB
        const form = await FormDAO.getForm(formId);

        if (form) {
          setFormDefinition(form);
        } else {
          // If not in IndexedDB, try to fetch from API
          const response = await fetch(`/api/forms/${formId}`);

          if (!response.ok) {
            throw new Error(`Failed to fetch form: ${response.statusText}`);
          }

          const data = await response.json();

          // Save to IndexedDB for offline use
          await FormDAO.saveForm(data);

          setFormDefinition(data);
        }
      } catch (err) {
        console.error("Error loading form:", err);
        setError(
          "Failed to load form. Please check your connection and try again."
        );
      } finally {
        setLoading(false);
      }
    };

    if (formId) {
      fetchForm();
    }
  }, [formId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin mb-4 h-12 w-12 border-t-2 border-b-2 border-blue-500 rounded-full mx-auto"></div>
          <p className="text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-red-500 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Error Loading Form
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              >
                Try Again
              </button>
              <a
                href="/"
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              >
                Go Back Home
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!formDefinition) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-yellow-500 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Form Not Found
            </h2>
            <p className="text-gray-600 mb-6">
              The form you're looking for doesn't exist or has been removed.
            </p>
            <a
              href="/"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
              Go Back Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        <FormRenderer
          formDefinition={formDefinition}
          draftId={draftId || null}
        />
      </div>
    </div>
  );
};

export default FormPage;

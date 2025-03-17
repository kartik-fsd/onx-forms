// src/context/FormContext.jsx
import { createContext } from "preact";
import { useContext, useReducer, useEffect, useCallback } from "preact/hooks";
import { FormDataDAO, DraftDAO, SyncQueueDAO } from "../db";
import { debounce } from "../utils/helper";

// Form Context
const FormContext = createContext();

// Action types
const ACTIONS = {
  INIT_FORM: "INIT_FORM",
  LOAD_DRAFT: "LOAD_DRAFT",
  UPDATE_FIELD: "UPDATE_FIELD",
  SET_STEP: "SET_STEP",
  SAVE_DRAFT: "SAVE_DRAFT",
  SUBMIT_FORM: "SUBMIT_FORM",
  SET_ERROR: "SET_ERROR",
  CLEAR_ERROR: "CLEAR_ERROR",
  SET_LOADING: "SET_LOADING",
};

// Initial state
const initialState = {
  formId: null,
  projectId: null,
  draftId: null,
  currentStep: 0,
  totalSteps: 0,
  formData: {},
  isSubmitting: false,
  isSaving: false,
  isLoading: false,
  error: null,
  lastSaved: null,
};

// Reducer function
const formReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.INIT_FORM:
      return {
        ...state,
        formId: action.payload.formId,
        projectId: action.payload.projectId,
        totalSteps: action.payload.totalSteps,
        formData: action.payload.initialData || {},
        currentStep: 0,
        isLoading: false,
      };

    case ACTIONS.LOAD_DRAFT:
      return {
        ...state,
        draftId: action.payload.draftId,
        formData: action.payload.data,
        currentStep: action.payload.currentStep || 0,
        lastSaved: action.payload.lastUpdated,
        isLoading: false,
      };

    case ACTIONS.UPDATE_FIELD:
      return {
        ...state,
        formData: {
          ...state.formData,
          [action.payload.field]: action.payload.value,
        },
      };

    case ACTIONS.SET_STEP:
      return {
        ...state,
        currentStep: action.payload.step,
      };

    case ACTIONS.SAVE_DRAFT:
      return {
        ...state,
        draftId: action.payload.draftId,
        lastSaved: action.payload.timestamp,
        isSaving: false,
      };

    case ACTIONS.SUBMIT_FORM:
      return {
        ...state,
        isSubmitting: false,
        draftId: null, // Clear draft after successful submission
        formData: {}, // Clear form data after successful submission
      };

    case ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload.error,
        isSubmitting: false,
        isSaving: false,
        isLoading: false,
      };

    case ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };

    case ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload.isLoading,
        isSaving: action.payload.isSaving || false,
        isSubmitting: action.payload.isSubmitting || false,
      };

    default:
      return state;
  }
};

// Provider component
export const FormProvider = ({ children }) => {
  const [state, dispatch] = useReducer(formReducer, initialState);

  // Debounced save to prevent excessive writes
  const debouncedSaveDraft = useCallback(
    debounce(async (formId, draftId, data, currentStep) => {
      try {
        const draftData = {
          formId,
          data,
          currentStep,
        };

        if (draftId) {
          draftData.id = draftId;
        }

        const savedId = await DraftDAO.saveDraft(draftData);

        dispatch({
          type: ACTIONS.SAVE_DRAFT,
          payload: {
            draftId: savedId || draftId,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error("Error saving draft:", error);
        dispatch({
          type: ACTIONS.SET_ERROR,
          payload: { error: "Failed to save draft. Please try again." },
        });
      }
    }, 1000),
    []
  );

  // Auto-save effect
  useEffect(() => {
    if (state.formId && Object.keys(state.formData).length > 0) {
      debouncedSaveDraft(
        state.formId,
        state.draftId,
        state.formData,
        state.currentStep
      );
    }
  }, [
    state.formData,
    state.currentStep,
    debouncedSaveDraft,
    state.formId,
    state.draftId,
  ]);

  // Initialize form
  const initForm = useCallback(
    async (formId, projectId, totalSteps, initialData = {}) => {
      dispatch({
        type: ACTIONS.SET_LOADING,
        payload: { isLoading: true },
      });

      try {
        dispatch({
          type: ACTIONS.INIT_FORM,
          payload: { formId, projectId, totalSteps, initialData },
        });
      } catch (error) {
        console.error("Error initializing form:", error);
        dispatch({
          type: ACTIONS.SET_ERROR,
          payload: {
            error: "Failed to initialize form. Please refresh the page.",
          },
        });
      }
    },
    []
  );

  // Load draft
  const loadDraft = useCallback(async (draftId) => {
    dispatch({
      type: ACTIONS.SET_LOADING,
      payload: { isLoading: true },
    });

    try {
      const draft = await DraftDAO.getDraft(draftId);
      if (draft) {
        dispatch({
          type: ACTIONS.LOAD_DRAFT,
          payload: {
            draftId,
            data: draft.data,
            currentStep: draft.currentStep,
            lastUpdated: draft.lastUpdated,
          },
        });
      } else {
        dispatch({
          type: ACTIONS.SET_ERROR,
          payload: { error: "Draft not found." },
        });
      }
    } catch (error) {
      console.error("Error loading draft:", error);
      dispatch({
        type: ACTIONS.SET_ERROR,
        payload: { error: "Failed to load draft. Please try again." },
      });
    }
  }, []);

  // Update field value
  const updateField = useCallback((field, value) => {
    dispatch({
      type: ACTIONS.UPDATE_FIELD,
      payload: { field, value },
    });
  }, []);

  // Set current step
  const setStep = useCallback((step) => {
    dispatch({
      type: ACTIONS.SET_STEP,
      payload: { step },
    });
  }, []);

  // Save draft manually
  const saveDraft = useCallback(async () => {
    if (!state.formId) return;

    dispatch({
      type: ACTIONS.SET_LOADING,
      payload: { isSaving: true },
    });

    try {
      const draftData = {
        formId: state.formId,
        data: state.formData,
        currentStep: state.currentStep,
      };

      if (state.draftId) {
        draftData.id = state.draftId;
      }

      const savedId = await DraftDAO.saveDraft(draftData);

      dispatch({
        type: ACTIONS.SAVE_DRAFT,
        payload: {
          draftId: savedId || state.draftId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error saving draft:", error);
      dispatch({
        type: ACTIONS.SET_ERROR,
        payload: { error: "Failed to save draft. Please try again." },
      });
    }
  }, [state.formId, state.formData, state.currentStep, state.draftId]);

  // Submit form
  const submitForm = useCallback(async () => {
    if (!state.formId) return;

    dispatch({
      type: ACTIONS.SET_LOADING,
      payload: { isSubmitting: true },
    });

    try {
      // First save to IndexedDB
      const formDataEntry = {
        formId: state.formId,
        projectId: state.projectId,
        data: state.formData,
        submitted: false,
        createdAt: new Date().toISOString(),
      };

      const formDataId = await FormDataDAO.saveFormData(formDataEntry);

      // Add to sync queue for later submission to server
      await SyncQueueDAO.addToQueue({
        type: "FORM_SUBMISSION",
        data: { formDataId },
      });

      // If there was a draft, delete it
      if (state.draftId) {
        await DraftDAO.deleteDraft(state.draftId);
      }

      dispatch({ type: ACTIONS.SUBMIT_FORM });

      return formDataId;
    } catch (error) {
      console.error("Error submitting form:", error);
      dispatch({
        type: ACTIONS.SET_ERROR,
        payload: {
          error: "Failed to submit form. Your data has been saved as a draft.",
        },
      });
      return null;
    }
  }, [state.formId, state.projectId, state.formData, state.draftId]);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_ERROR });
  }, []);

  // Context value
  const value = {
    ...state,
    initForm,
    loadDraft,
    updateField,
    setStep,
    saveDraft,
    submitForm,
    clearError,
  };

  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
};

// Custom hook to use the form context
export const useForm = () => {
  const context = useContext(FormContext);
  if (context === undefined) {
    throw new Error("useForm must be used within a FormProvider");
  }
  return context;
};

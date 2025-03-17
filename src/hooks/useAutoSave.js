import { useState, useEffect, useCallback, useRef } from 'preact/hooks';

/**
 * Custom hook for automatically saving form data
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.data - The data to be saved
 * @param {Function} options.saveFunction - Function to call for saving data
 * @param {number} options.debounceMs - Debounce time in milliseconds
 * @param {boolean} options.enabled - Whether auto-save is enabled
 * @param {number} options.minChanges - Minimum number of changes before saving
 * @returns {Object} Auto-save state and functions
 */
export const useAutoSave = ({
    data,
    saveFunction,
    debounceMs = 1000,
    enabled = true,
    minChanges = 1
}) => {
    const [isSaving, setIsSaving] = useState(false);
    const [lastAutoSave, setLastAutoSave] = useState(null);
    const [error, setError] = useState(null);
    const [changeCount, setChangeCount] = useState(0);

    // Refs to maintain identity between renders
    const dataRef = useRef(data);
    const saveFunctionRef = useRef(saveFunction);
    const timerRef = useRef(null);

    // Update refs when dependencies change
    useEffect(() => {
        dataRef.current = data;
        saveFunctionRef.current = saveFunction;
    }, [data, saveFunction]);

    // Reset change count when enabled changes
    useEffect(() => {
        if (enabled) {
            setChangeCount(0);
        }
    }, [enabled]);

    // Increment change count when data changes
    useEffect(() => {
        if (enabled) {
            setChangeCount(prev => prev + 1);
        }
    }, [data, enabled]);

    // Perform the actual save
    const performSave = useCallback(async () => {
        if (!saveFunctionRef.current) return;

        try {
            setIsSaving(true);
            setError(null);

            const result = await saveFunctionRef.current(dataRef.current);

            setLastAutoSave(new Date());
            setChangeCount(0);

            return result;
        } catch (err) {
            console.error('Auto-save error:', err);
            setError(err.message || 'Failed to save');
            return null;
        } finally {
            setIsSaving(false);
        }
    }, []);

    // Debounced save function
    const debouncedSave = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(async () => {
            if (changeCount >= minChanges) {
                await performSave();
            }
        }, debounceMs);
    }, [debounceMs, minChanges, performSave, changeCount]);

    // Trigger debounced save when data changes
    useEffect(() => {
        if (enabled && changeCount >= minChanges) {
            debouncedSave();
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [data, enabled, debouncedSave, changeCount, minChanges]);

    // Manually trigger save
    const triggerSave = useCallback(async (dataToSave = null) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        if (dataToSave) {
            dataRef.current = dataToSave;
        }

        return performSave();
    }, [performSave]);

    return {
        isSaving,
        lastAutoSave,
        error,
        triggerSave,
        changeCount
    };
};
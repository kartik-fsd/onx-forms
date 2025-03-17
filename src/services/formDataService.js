import { openDB } from 'idb';
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'form-data';
const DRAFTS_STORE = 'drafts';
const SUBMISSIONS_STORE = 'submissions';
const VERSION = 1;

// Initialize IndexedDB
async function initDB() {
    return openDB(DB_NAME, VERSION, {
        upgrade(db) {
            // Store for draft forms
            if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
                const draftsStore = db.createObjectStore(DRAFTS_STORE, { keyPath: 'id' });
                draftsStore.createIndex('formId', 'formId', { unique: false });
                draftsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            }

            // Store for form submissions
            if (!db.objectStoreNames.contains(SUBMISSIONS_STORE)) {
                const submissionsStore = db.createObjectStore(SUBMISSIONS_STORE, { keyPath: 'id' });
                submissionsStore.createIndex('formId', 'formId', { unique: false });
                submissionsStore.createIndex('projectId', 'projectId', { unique: false });
                submissionsStore.createIndex('status', 'status', { unique: false });
                submissionsStore.createIndex('createdAt', 'createdAt', { unique: false });
            }
        }
    });
}

/**
 * Save a form draft
 * @param {Object} draft - The draft to save
 * @returns {Promise<string>} The draft ID
 */
async function saveDraft(draft) {
    try {
        const db = await initDB();

        // If no ID provided, generate one
        if (!draft.id) {
            draft.id = uuidv4();
        }

        // Add timestamps
        draft.updatedAt = new Date().toISOString();
        if (!draft.createdAt) {
            draft.createdAt = draft.updatedAt;
        }

        await db.put(DRAFTS_STORE, draft);
        return draft.id;
    } catch (error) {
        console.error('Error saving draft:', error);
        throw error;
    }
}

/**
 * Get a draft by ID
 * @param {string} id - The draft ID
 * @returns {Promise<Object>} The draft object
 */
async function getDraft(id) {
    try {
        const db = await initDB();
        return db.get(DRAFTS_STORE, id);
    } catch (error) {
        console.error('Error getting draft:', error);
        throw error;
    }
}

/**
 * Get all drafts for a form
 * @param {string} formId - The form ID
 * @returns {Promise<Array>} Array of draft objects
 */
async function getDraftsByForm(formId) {
    try {
        const db = await initDB();
        return db.getAllFromIndex(DRAFTS_STORE, 'formId', formId);
    } catch (error) {
        console.error('Error getting drafts by form:', error);
        throw error;
    }
}

/**
 * Delete a draft
 * @param {string} id - The draft ID
 * @returns {Promise<boolean>} Success indicator
 */
async function deleteDraft(id) {
    try {
        const db = await initDB();
        await db.delete(DRAFTS_STORE, id);
        return true;
    } catch (error) {
        console.error('Error deleting draft:', error);
        throw error;
    }
}

/**
 * Submit a form
 * @param {Object} formData - The form data to submit
 * @returns {Promise<string>} The submission ID
 */
async function submitForm(formData) {
    try {
        const db = await initDB();

        // Create submission record
        const submission = {
            id: uuidv4(),
            formId: formData.formId,
            projectId: formData.projectId,
            data: formData.data,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncRetries: 0,
            version: formData.version || 1
        };

        // Save to IndexedDB
        await db.add(SUBMISSIONS_STORE, submission);

        // Try to submit immediately if online
        if (navigator.onLine) {
            try {
                await submitToServer(submission.id);
            } catch (error) {
                console.warn('Initial submission failed, will retry later:', error);
            }
        }

        return submission.id;
    } catch (error) {
        console.error('Error submitting form:', error);
        throw error;
    }
}

/**
 * Submit a form to the server
 * @param {string} submissionId - The submission ID
 * @returns {Promise<Object>} The server response
 */
async function submitToServer(submissionId) {
    try {
        const db = await initDB();
        const submission = await db.get(SUBMISSIONS_STORE, submissionId);

        if (!submission) {
            throw new Error(`Submission with ID ${submissionId} not found`);
        }

        // Update status to uploading
        await db.put(SUBMISSIONS_STORE, {
            ...submission,
            status: 'uploading',
            updatedAt: new Date().toISOString()
        });

        // Submit to server
        const response = await fetch('/api/submissions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: submission.id,
                formId: submission.formId,
                projectId: submission.projectId,
                data: submission.data,
                createdAt: submission.createdAt,
                version: submission.version
            })
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        // Update status to completed
        await db.put(SUBMISSIONS_STORE, {
            ...submission,
            status: 'completed',
            serverResponse: result,
            syncedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        return result;
    } catch (error) {
        console.error(`Error submitting to server (ID: ${submissionId}):`, error);

        // Update status to error
        const db = await initDB();
        const submission = await db.get(SUBMISSIONS_STORE, submissionId);

        if (submission) {
            await db.put(SUBMISSIONS_STORE, {
                ...submission,
                status: 'error',
                error: error.message,
                updatedAt: new Date().toISOString()
            });
        }

        throw error;
    }
}

/**
 * Update submission retry counter
 * @param {string} submissionId - The submission ID
 * @returns {Promise<boolean>} Success indicator
 */
async function updateSubmissionRetry(submissionId) {
    try {
        const db = await initDB();
        const submission = await db.get(SUBMISSIONS_STORE, submissionId);

        if (!submission) {
            throw new Error(`Submission with ID ${submissionId} not found`);
        }

        const updatedRetries = (submission.syncRetries || 0) + 1;

        // If we've tried too many times, mark as failed
        const status = updatedRetries >= 5 ? 'failed' : 'pending';

        await db.put(SUBMISSIONS_STORE, {
            ...submission,
            status,
            syncRetries: updatedRetries,
            updatedAt: new Date().toISOString(),
            // Add exponential backoff
            nextRetry: status === 'pending' ?
                new Date(Date.now() + (Math.pow(2, updatedRetries) * 30000)).toISOString() :
                null
        });

        return true;
    } catch (error) {
        console.error('Error updating submission retry:', error);
        throw error;
    }
}

/**
 * Get pending submissions
 * @returns {Promise<Array>} Array of pending submissions
 */
async function getPendingSubmissions() {
    try {
        const db = await initDB();

        // Get all pending submissions
        const pending = await db.getAllFromIndex(SUBMISSIONS_STORE, 'status', 'pending');

        // Filter by retry time
        const now = new Date().toISOString();
        return pending.filter(submission =>
            !submission.nextRetry || submission.nextRetry <= now
        );
    } catch (error) {
        console.error('Error getting pending submissions:', error);
        throw error;
    }
}

/**
 * Get a submission by ID
 * @param {string} id - The submission ID
 * @returns {Promise<Object>} The submission object
 */
async function getSubmission(id) {
    try {
        const db = await initDB();
        return db.get(SUBMISSIONS_STORE, id);
    } catch (error) {
        console.error('Error getting submission:', error);
        throw error;
    }
}

/**
 * Get all submissions for a form
 * @param {string} formId - The form ID
 * @returns {Promise<Array>} Array of submission objects
 */
async function getSubmissionsByForm(formId) {
    try {
        const db = await initDB();
        return db.getAllFromIndex(SUBMISSIONS_STORE, 'formId', formId);
    } catch (error) {
        console.error('Error getting submissions by form:', error);
        throw error;
    }
}

export default {
    saveDraft,
    getDraft,
    getDraftsByForm,
    deleteDraft,
    submitForm,
    submitToServer,
    updateSubmissionRetry,
    getPendingSubmissions,
    getSubmission,
    getSubmissionsByForm
};
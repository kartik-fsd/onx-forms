import { openDB } from 'idb';

const DB_NAME = 'fse-lead-collection';
const DB_VERSION = 1;

export const STORES = {
    FORMS: 'forms',
    FORM_DATA: 'form-data',
    DRAFTS: 'drafts',
    MEDIA: 'media',
    SYNC_QUEUE: 'sync-queue'
};

export const openDatabase = async () => {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // Store for form definitions
            if (!db.objectStoreNames.contains(STORES.FORMS)) {
                const formStore = db.createObjectStore(STORES.FORMS, {
                    keyPath: 'id'
                });
                formStore.createIndex('projectId', 'projectId', { unique: false });
            }

            // Store for completed form submissions
            if (!db.objectStoreNames.contains(STORES.FORM_DATA)) {
                const formDataStore = db.createObjectStore(STORES.FORM_DATA, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                formDataStore.createIndex('formId', 'formId', { unique: false });
                formDataStore.createIndex('submitted', 'submitted', { unique: false });
                formDataStore.createIndex('createdAt', 'createdAt', { unique: false });
            }

            // Store for draft form submissions
            if (!db.objectStoreNames.contains(STORES.DRAFTS)) {
                const draftsStore = db.createObjectStore(STORES.DRAFTS, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                draftsStore.createIndex('formId', 'formId', { unique: false });
                draftsStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
            }

            // Store for media files (images, videos, etc.)
            if (!db.objectStoreNames.contains(STORES.MEDIA)) {
                const mediaStore = db.createObjectStore(STORES.MEDIA, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                mediaStore.createIndex('formDataId', 'formDataId', { unique: false });
                mediaStore.createIndex('fieldName', 'fieldName', { unique: false });
            }

            // Store for synchronization queue
            if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
                const syncQueueStore = db.createObjectStore(STORES.SYNC_QUEUE, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                syncQueueStore.createIndex('type', 'type', { unique: false });
                syncQueueStore.createIndex('status', 'status', { unique: false });
                syncQueueStore.createIndex('createdAt', 'createdAt', { unique: false });
            }
        }
    });
};

// Database access object for form operations
export const FormDAO = {
    async getForm(formId) {
        const db = await openDatabase();
        return db.get(STORES.FORMS, formId);
    },

    async getFormsByProject(projectId) {
        const db = await openDatabase();
        return db.getAllFromIndex(STORES.FORMS, 'projectId', projectId);
    },

    async saveForm(form) {
        const db = await openDatabase();
        return db.put(STORES.FORMS, {
            ...form,
            updatedAt: new Date().toISOString()
        });
    }
};

// Database access object for form data operations
export const FormDataDAO = {
    async getFormData(id) {
        const db = await openDatabase();
        return db.get(STORES.FORM_DATA, id);
    },

    async getFormDataByForm(formId) {
        const db = await openDatabase();
        return db.getAllFromIndex(STORES.FORM_DATA, 'formId', formId);
    },

    async saveFormData(formData) {
        const db = await openDatabase();
        const now = new Date().toISOString();
        const data = {
            ...formData,
            updatedAt: now
        };

        // If it's a new entry, add createdAt
        if (!formData.id) {
            data.createdAt = now;
        }

        return db.put(STORES.FORM_DATA, data);
    },

    async markAsSubmitted(id) {
        const db = await openDatabase();
        const formData = await db.get(STORES.FORM_DATA, id);
        if (formData) {
            formData.submitted = true;
            formData.submittedAt = new Date().toISOString();
            return db.put(STORES.FORM_DATA, formData);
        }
        return null;
    }
};

// Database access object for draft operations
export const DraftDAO = {
    async getDraft(id) {
        const db = await openDatabase();
        return db.get(STORES.DRAFTS, id);
    },

    async getDraftsByForm(formId) {
        const db = await openDatabase();
        return db.getAllFromIndex(STORES.DRAFTS, 'formId', formId);
    },

    async saveDraft(draft) {
        const db = await openDatabase();
        const now = new Date().toISOString();
        const data = {
            ...draft,
            lastUpdated: now
        };

        // If it's a new entry, add createdAt
        if (!draft.id) {
            data.createdAt = now;
        }

        return db.put(STORES.DRAFTS, data);
    },

    async deleteDraft(id) {
        const db = await openDatabase();
        return db.delete(STORES.DRAFTS, id);
    }
};

// Database access object for media operations
export const MediaDAO = {
    async saveMedia(media) {
        const db = await openDatabase();
        return db.add(STORES.MEDIA, media);
    },

    async getMediaByFormData(formDataId) {
        const db = await openDatabase();
        return db.getAllFromIndex(STORES.MEDIA, 'formDataId', formDataId);
    }
};

// Database access object for sync queue operations
export const SyncQueueDAO = {
    async addToQueue(item) {
        const db = await openDatabase();
        return db.add(STORES.SYNC_QUEUE, {
            ...item,
            status: 'pending',
            createdAt: new Date().toISOString(),
            attempts: 0
        });
    },

    async getNextBatch(limit = 10) {
        const db = await openDatabase();
        const tx = db.transaction(STORES.SYNC_QUEUE, 'readonly');
        const index = tx.store.index('status');
        const items = await index.getAll('pending', limit);
        await tx.done;
        return items;
    },

    async updateStatus(id, status, error = null) {
        const db = await openDatabase();
        const item = await db.get(STORES.SYNC_QUEUE, id);
        if (item) {
            item.status = status;
            item.updatedAt = new Date().toISOString();
            item.attempts += 1;
            if (error) {
                item.lastError = error.toString();
            }
            return db.put(STORES.SYNC_QUEUE, item);
        }
        return null;
    }
};
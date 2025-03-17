import { openDB } from 'idb';

const DB_NAME = 'form-templates';
const STORE_NAME = 'templates';
const VERSION = 1;

// Initialize IndexedDB
async function initDB() {
    return openDB(DB_NAME, VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('projectId', 'projectId', { unique: false });
                store.createIndex('version', 'version', { unique: false });
                store.createIndex('updatedAt', 'updatedAt', { unique: false });
            }
        }
    });
}

// Parse a form template to add additional computed properties
function parseTemplate(template) {
    if (!template) return null;

    // Deep clone to avoid modifying the original
    const parsed = JSON.parse(JSON.stringify(template));

    // Normalize steps
    if (!parsed.steps || !Array.isArray(parsed.steps)) {
        parsed.steps = [];
    }

    // Process each step
    parsed.steps = parsed.steps.map((step, stepIndex) => {
        // Normalize fields
        if (!step.fields || !Array.isArray(step.fields)) {
            step.fields = [];
        }

        // Process each field
        step.fields = step.fields.map((field, fieldIndex) => {
            // Ensure field has an ID
            if (!field.id) {
                field.id = `field_${stepIndex}_${fieldIndex}`;
            }

            // Process conditional display logic
            if (field.showIf) {
                const { field: conditionField, value: conditionValue, operator = '==' } = field.showIf;

                field.conditionalLogic = {
                    dependsOn: conditionField,
                    condition: (formData) => {
                        const fieldValue = formData[conditionField];

                        switch (operator) {
                            case '==':
                                return fieldValue == conditionValue;
                            case '!=':
                                return fieldValue != conditionValue;
                            case '>':
                                return fieldValue > conditionValue;
                            case '<':
                                return fieldValue < conditionValue;
                            case '>=':
                                return fieldValue >= conditionValue;
                            case '<=':
                                return fieldValue <= conditionValue;
                            case 'includes':
                                return Array.isArray(fieldValue) && fieldValue.includes(conditionValue);
                            case 'empty':
                                return !fieldValue ||
                                    (typeof fieldValue === 'string' && fieldValue.trim() === '') ||
                                    (Array.isArray(fieldValue) && fieldValue.length === 0);
                            case 'notEmpty':
                                return fieldValue &&
                                    (typeof fieldValue !== 'string' || fieldValue.trim() !== '') &&
                                    (!Array.isArray(fieldValue) || fieldValue.length > 0);
                            default:
                                return true;
                        }
                    }
                };
            }

            return field;
        });

        return step;
    });

    // Add computed properties
    parsed.totalSteps = parsed.steps.length;
    parsed.updatedAt = parsed.updatedAt || new Date().toISOString();

    return parsed;
}

// Fetch a form template from IndexedDB
async function getFormTemplate(id) {
    try {
        const db = await initDB();
        const template = await db.get(STORE_NAME, id);

        if (!template) {
            console.warn(`Template with ID ${id} not found in local storage`);
            return null;
        }

        return parseTemplate(template);
    } catch (error) {
        console.error('Error fetching form template:', error);
        throw error;
    }
}

// Fetch a form template from the server
async function fetchFormTemplate(id, apiUrl) {
    try {
        const response = await fetch(`${apiUrl}/api/forms/${id}`);

        if (!response.ok) {
            throw new Error(`Failed to fetch template: ${response.statusText}`);
        }

        const template = await response.json();

        // Save to IndexedDB
        const db = await initDB();
        await db.put(STORE_NAME, {
            ...template,
            cachedAt: new Date().toISOString()
        });

        return parseTemplate(template);
    } catch (error) {
        console.error('Error fetching form template from API:', error);
        throw error;
    }
}

// Get or fetch a form template
async function getOrFetchFormTemplate(id, apiUrl) {
    try {
        // Try to get from IndexedDB first
        const cachedTemplate = await getFormTemplate(id);

        // If online, check for updates
        if (navigator.onLine) {
            try {
                const freshTemplate = await fetchFormTemplate(id, apiUrl);
                return freshTemplate;
            } catch (error) {
                // If online fetch fails but we have a cached version, use that
                if (cachedTemplate) {
                    console.warn('Failed to fetch updated template, using cached version');
                    return cachedTemplate;
                }

                // Otherwise rethrow
                throw error;
            }
        }

        // If offline and we have a cached version, use that
        if (cachedTemplate) {
            return cachedTemplate;
        }

        // If offline and no cached version, error
        throw new Error(`Cannot fetch form template ${id} while offline and no cached version exists`);
    } catch (error) {
        console.error('Error in getOrFetchFormTemplate:', error);
        throw error;
    }
}

// Get all templates by project ID
async function getTemplatesByProject(projectId) {
    try {
        const db = await initDB();
        const templates = await db.getAllFromIndex(STORE_NAME, 'projectId', projectId);
        return templates.map(parseTemplate);
    } catch (error) {
        console.error('Error fetching templates by project:', error);
        throw error;
    }
}

// Save a form template to IndexedDB
async function saveFormTemplate(template) {
    try {
        if (!template || !template.id) {
            throw new Error('Invalid template: missing ID');
        }

        const db = await initDB();

        // Add metadata if not present
        const templateToSave = {
            ...template,
            updatedAt: new Date().toISOString()
        };

        await db.put(STORE_NAME, templateToSave);
        return parseTemplate(templateToSave);
    } catch (error) {
        console.error('Error saving form template:', error);
        throw error;
    }
}

// Delete a form template
async function deleteFormTemplate(id) {
    try {
        const db = await initDB();
        await db.delete(STORE_NAME, id);
        return true;
    } catch (error) {
        console.error('Error deleting form template:', error);
        throw error;
    }
}

// Get default template for a new form
function getDefaultTemplate(projectId) {
    return parseTemplate({
        id: `new-${Date.now()}`,
        projectId,
        title: 'New Form',
        description: 'Form description',
        version: 1,
        steps: [
            {
                title: 'FSE Information',
                description: 'Enter your information',
                fields: [
                    {
                        id: 'fse_name',
                        name: 'fse_name',
                        type: 'text',
                        label: 'FSE Name',
                        required: true
                    },
                    {
                        id: 'fse_id',
                        name: 'fse_id',
                        type: 'text',
                        label: 'FSE ID',
                        required: true
                    },
                    {
                        id: 'store_id',
                        name: 'store_id',
                        type: 'text',
                        label: 'Store ID',
                        required: true
                    }
                ]
            }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
}

// Check if a field should be displayed based on conditional logic
function shouldDisplayField(field, formData) {
    if (!field.conditionalLogic) return true;

    const { dependsOn, condition } = field.conditionalLogic;

    // If the field it depends on doesn't exist in the form data, show the field
    if (!formData.hasOwnProperty(dependsOn)) return true;

    // Apply the condition
    return condition(formData);
}

// Process a form template, applying conditional logic
function processTemplate(template, formData = {}) {
    if (!template) return null;

    // Deep clone to avoid modifying the original
    const processed = JSON.parse(JSON.stringify(template));

    // Process each step
    processed.steps = processed.steps.map(step => {
        // Filter fields based on conditional logic
        step.fields = step.fields.filter(field => shouldDisplayField(field, formData));
        return step;
    });

    return processed;
}

export default {
    getFormTemplate,
    fetchFormTemplate,
    getOrFetchFormTemplate,
    getTemplatesByProject,
    saveFormTemplate,
    deleteFormTemplate,
    getDefaultTemplate,
    processTemplate,
    shouldDisplayField
};
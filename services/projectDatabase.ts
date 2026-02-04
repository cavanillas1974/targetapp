
import { Project, ProjectMetadata } from '../types';

const DB_NAME = 'TargetAppDB';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_METADATA = 'metadata';

class ProjectDatabase {
    private dbPromise: Promise<IDBDatabase>;

    constructor() {
        this.dbPromise = this.openDB();
    }

    private openDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
                    db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORE_METADATA)) {
                    db.createObjectStore(STORE_METADATA, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                resolve((event.target as IDBOpenDBRequest).result);
            };

            request.onerror = (event) => {
                reject((event.target as IDBOpenDBRequest).error);
            };
        });
    }

    async saveProject(project: Project): Promise<void> {
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_PROJECTS, STORE_METADATA], 'readwrite');

            const projectsStore = transaction.objectStore(STORE_PROJECTS);
            const metadataStore = transaction.objectStore(STORE_METADATA);

            const metadata = project.metadata;

            // Save full project
            const projectRequest = projectsStore.put({ ...project, id: metadata.id });

            // Save metadata separately for quick listing
            const metadataRequest = metadataStore.put(metadata);

            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject((event.target as IDBTransaction).error);
        });
    }

    async loadProject(id: string): Promise<Project | null> {
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_PROJECTS, 'readonly');
            const store = transaction.objectStore(STORE_PROJECTS);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = (event) => reject((event.target as IDBRequest).error);
        });
    }

    async getAllProjectsMetadata(): Promise<ProjectMetadata[]> {
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_METADATA, 'readonly');
            const store = transaction.objectStore(STORE_METADATA);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = (event) => reject((event.target as IDBRequest).error);
        });
    }

    async deleteProject(id: string): Promise<void> {
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_PROJECTS, STORE_METADATA], 'readwrite');
            const projectsStore = transaction.objectStore(STORE_PROJECTS);
            const metadataStore = transaction.objectStore(STORE_METADATA);

            projectsStore.delete(id);
            metadataStore.delete(id);

            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject((event.target as IDBTransaction).error);
        });
    }
}

export const projectDatabase = new ProjectDatabase();

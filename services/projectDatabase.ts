
import { Project, ProjectMetadata } from '../types';

const DB_NAME = 'TargetAppDB';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_METADATA = 'metadata';

class ProjectDatabase {
    private dbPromise: Promise<IDBDatabase> | null = null;

    constructor() {
        this.getDB();
    }

    private getDB(): Promise<IDBDatabase> {
        if (!this.dbPromise) {
            this.dbPromise = this.openDB();
        }
        return this.dbPromise;
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
                const db = (event.target as IDBOpenDBRequest).result;
                // Manejar cierre de conexión inesperado
                db.onversionchange = () => {
                    db.close();
                    this.dbPromise = null;
                };
                db.onclose = () => {
                    this.dbPromise = null;
                };
                resolve(db);
            };

            request.onerror = (event) => {
                this.dbPromise = null; // Reset promise on error
                reject((event.target as IDBOpenDBRequest).error);
            };
        });
    }

    private async getActiveDB() {
        try {
            const db = await this.getDB();
            // Verificar si la conexión está cerrada para intentar reconectar
            // Desafortunadamente no hay propiedad isClosed estándar fácil,
            // pero si falla la transacción lo sabremos.
            return db;
        } catch (e) {
            this.dbPromise = null;
            return this.getDB();
        }
    }

    async saveProject(project: Project): Promise<void> {
        let db = await this.getActiveDB();
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction([STORE_PROJECTS, STORE_METADATA], 'readwrite');

                const projectsStore = transaction.objectStore(STORE_PROJECTS);
                const metadataStore = transaction.objectStore(STORE_METADATA);

                const metadata = project.metadata;

                // Save full project
                projectsStore.put({ ...project, id: metadata.id });

                // Save metadata separately for quick listing
                metadataStore.put(metadata);

                transaction.oncomplete = () => resolve();
                transaction.onerror = (event) => {
                    const error = (event.target as IDBTransaction).error;
                    if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
                        // DB closed -> Force reset for next try
                        this.dbPromise = null;
                    }
                    reject(error);
                };
            } catch (err: any) {
                if (err?.name === 'InvalidStateError' || err?.message?.includes('closing')) {
                    this.dbPromise = null; // Reset connection cache
                }
                reject(err);
            }
        });
    }

    async loadProject(id: string): Promise<Project | null> {
        const db = await this.getActiveDB();
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction(STORE_PROJECTS, 'readonly');
                const store = transaction.objectStore(STORE_PROJECTS);
                const request = store.get(id);

                request.onsuccess = () => resolve(request.result || null);
                request.onerror = (event) => reject((event.target as IDBRequest).error);
            } catch (e) {
                this.dbPromise = null;
                reject(e);
            }
        });
    }

    async getAllProjectsMetadata(): Promise<ProjectMetadata[]> {
        const db = await this.getActiveDB();
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction(STORE_METADATA, 'readonly');
                const store = transaction.objectStore(STORE_METADATA);
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = (event) => reject((event.target as IDBRequest).error);
            } catch (e) {
                this.dbPromise = null;
                reject(e);
            }
        });
    }

    async deleteProject(id: string): Promise<void> {
        const db = await this.getActiveDB();
        return new Promise((resolve, reject) => {
            try {
                const transaction = db.transaction([STORE_PROJECTS, STORE_METADATA], 'readwrite');
                const projectsStore = transaction.objectStore(STORE_PROJECTS);
                const metadataStore = transaction.objectStore(STORE_METADATA);

                projectsStore.delete(id);
                metadataStore.delete(id);

                transaction.oncomplete = () => resolve();
                transaction.onerror = (event) => reject((event.target as IDBTransaction).error);
            } catch (e) {
                this.dbPromise = null;
                reject(e);
            }
        });
    }
}

export const projectDatabase = new ProjectDatabase();

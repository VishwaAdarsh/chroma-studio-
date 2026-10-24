import { Project } from '../types/editor';

const DB_NAME = 'chroma_studio_db';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_IMAGES = 'images';

const PROJECTS_STORAGE_KEY = 'chroma_studio_projects';
const FAVORITES_STORAGE_KEY = 'chroma_studio_favorites';
const SETTINGS_STORAGE_KEY = 'chroma_studio_settings';

export interface AppSettings {
  defaultFormat: 'jpeg' | 'png' | 'webp';
  defaultQuality: number;
  stripExifDefault: boolean;
  theme: 'dark' | 'obsidian';
  hapticFeedback: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultFormat: 'jpeg',
  defaultQuality: 0.92,
  stripExifDefault: true,
  theme: 'obsidian',
  hapticFeedback: true,
};

/**
 * Utility to convert base64 Data URL to Blob
 */
export function dataURLToBlob(dataURL: string): Blob {
  const parts = dataURL.split(',');
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(parts[1] || '');
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

export class StorageService {
  private static dbPromise: Promise<IDBDatabase> | null = null;
  private static migrationDone = false;
  private static cachedProjects: Project[] = [];

  /**
   * Opens or returns the singleton IndexedDB connection
   */
  public static openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const factory =
        typeof window !== 'undefined' && window.indexedDB
          ? window.indexedDB
          : typeof globalThis !== 'undefined' && globalThis.indexedDB
          ? globalThis.indexedDB
          : null;

      if (!factory) {
        reject(new Error('IndexedDB is not supported in this runtime environment'));
        return;
      }

      const request = factory.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          const projectStore = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
          projectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_IMAGES)) {
          db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
        }
      };

      request.onsuccess = async () => {
        const db = request.result;
        // Auto-migrate legacy projects on first database open
        if (!StorageService.migrationDone) {
          try {
            await StorageService.migrateLegacyLocalStorage(db);
          } catch (err) {
            console.warn('Auto-migration warning:', err);
          }
          StorageService.migrationDone = true;
        }
        resolve(db);
      };

      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error || new Error('Failed to open Chroma Studio IndexedDB'));
      };
    });

    return this.dbPromise;
  }

  /**
   * Backward-compatible migration from localStorage to IndexedDB
   * Reads legacy chroma_studio_projects, converts base64 to Blobs, writes to IDB,
   * verifies persistence, and safely clears the legacy localStorage key.
   */
  public static async migrateLegacyLocalStorage(dbInstance?: IDBDatabase): Promise<{ migratedCount: number }> {
    if (typeof localStorage === 'undefined') return { migratedCount: 0 };

    const legacyRaw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!legacyRaw) return { migratedCount: 0 };

    let legacyProjects: Project[] = [];
    try {
      legacyProjects = JSON.parse(legacyRaw);
    } catch {
      localStorage.removeItem(PROJECTS_STORAGE_KEY);
      return { migratedCount: 0 };
    }

    if (!Array.isArray(legacyProjects) || legacyProjects.length === 0) {
      localStorage.removeItem(PROJECTS_STORAGE_KEY);
      return { migratedCount: 0 };
    }

    const db = dbInstance || (await this.openDB());
    let migratedCount = 0;

    for (const project of legacyProjects) {
      if (!project.id) continue;

      let imageBlob: Blob | null = null;
      if (project.imageSrc && project.imageSrc.startsWith('data:image')) {
        try {
          imageBlob = dataURLToBlob(project.imageSrc);
        } catch (e) {
          console.warn('Failed converting base64 to blob during migration', e);
        }
      }

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_PROJECTS, STORE_IMAGES], 'readwrite');
        const projectStore = tx.objectStore(STORE_PROJECTS);
        const imageStore = tx.objectStore(STORE_IMAGES);

        // Store project metadata
        const projectRecord: Project = {
          ...project,
          // Keep thumbnail if exists, clear massive base64 imageSrc in metadata record
          imageSrc: project.imageSrc && !project.imageSrc.startsWith('data:image') ? project.imageSrc : '',
        };
        projectStore.put(projectRecord);

        // Store binary Blob in image store if present
        if (imageBlob) {
          imageStore.put({ id: project.id, blob: imageBlob });
        }

        tx.oncomplete = () => {
          migratedCount++;
          resolve();
        };
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    }

    // Safely remove legacy key only after all items have been successfully committed
    localStorage.removeItem(PROJECTS_STORAGE_KEY);
    return { migratedCount };
  }

  /**
   * Retrieves all saved projects from IndexedDB sorted by updatedAt desc
   */
  public static async getProjects(): Promise<Project[]> {
    try {
      const db = await this.openDB();
      return new Promise<Project[]>((resolve, reject) => {
        const tx = db.transaction([STORE_PROJECTS, STORE_IMAGES], 'readonly');
        const projectStore = tx.objectStore(STORE_PROJECTS);
        const imageStore = tx.objectStore(STORE_IMAGES);
        const request = projectStore.getAll();

        request.onsuccess = () => {
          const rawProjects: Project[] = request.result || [];
          rawProjects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

          // Resolve image blobs for projects if needed
          const projectsWithImages: Project[] = rawProjects.map((p) => ({ ...p }));
          let pending = projectsWithImages.length;
          if (pending === 0) {
            this.cachedProjects = [];
            resolve([]);
            return;
          }

          projectsWithImages.forEach((proj) => {
            if (!proj.imageSrc) {
              const imgReq = imageStore.get(proj.id);
              imgReq.onsuccess = () => {
                if (imgReq.result && imgReq.result.blob) {
                  try {
                    proj.imageSrc = URL.createObjectURL(imgReq.result.blob);
                  } catch {
                    // In environments without URL.createObjectURL
                  }
                }
                pending--;
                if (pending === 0) {
                  this.cachedProjects = projectsWithImages;
                  resolve(projectsWithImages);
                }
              };
              imgReq.onerror = () => {
                pending--;
                if (pending === 0) {
                  this.cachedProjects = projectsWithImages;
                  resolve(projectsWithImages);
                }
              };
            } else {
              pending--;
              if (pending === 0) {
                this.cachedProjects = projectsWithImages;
                resolve(projectsWithImages);
              }
            }
          });
        };

        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('Failed to get projects from IndexedDB', e);
      return this.cachedProjects;
    }
  }

  /**
   * Synchronous accessor for in-memory cached projects
   */
  public static getProjectsSync(): Project[] {
    return this.cachedProjects;
  }

  /**
   * Retrieves an image Blob for a project ID
   */
  public static async getImageBlob(projectId: string): Promise<Blob | null> {
    try {
      const db = await this.openDB();
      return new Promise<Blob | null>((resolve, reject) => {
        const tx = db.transaction(STORE_IMAGES, 'readonly');
        const store = tx.objectStore(STORE_IMAGES);
        const req = store.get(projectId);
        req.onsuccess = () => {
          if (req.result && req.result.blob) {
            resolve(req.result.blob as Blob);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error('Failed to fetch image blob', e);
      return null;
    }
  }

  /**
   * Saves or updates a project and its image binary data into IndexedDB
   */
  public static async saveProject(project: Project, imageBlob?: Blob): Promise<void> {
    try {
      const db = await this.openDB();

      let blobToSave = imageBlob || null;
      let runtimeSrc = project.imageSrc;

      if (!blobToSave && project.imageSrc && project.imageSrc.startsWith('data:image')) {
        try {
          blobToSave = dataURLToBlob(project.imageSrc);
        } catch {
          // ignore
        }
      }

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_PROJECTS, STORE_IMAGES], 'readwrite');
        const projectStore = tx.objectStore(STORE_PROJECTS);
        const imageStore = tx.objectStore(STORE_IMAGES);

        const projectRecord: Project = {
          ...project,
          imageSrc: runtimeSrc && !runtimeSrc.startsWith('data:image') ? runtimeSrc : '',
          updatedAt: Date.now(),
        };

        projectStore.put(projectRecord);

        if (blobToSave) {
          imageStore.put({ id: project.id, blob: blobToSave });
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });

      // Update in-memory cache
      const existingIdx = this.cachedProjects.findIndex((p) => p.id === project.id);
      if (existingIdx >= 0) {
        this.cachedProjects[existingIdx] = { ...project, updatedAt: Date.now() };
      } else {
        this.cachedProjects.unshift({ ...project, updatedAt: Date.now() });
      }
    } catch (e) {
      console.error('Failed to save project to IndexedDB', e);
    }
  }

  /**
   * Deletes a project and its associated image from IndexedDB
   */
  public static async deleteProject(projectId: string): Promise<void> {
    try {
      const db = await this.openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_PROJECTS, STORE_IMAGES], 'readwrite');
        tx.objectStore(STORE_PROJECTS).delete(projectId);
        tx.objectStore(STORE_IMAGES).delete(projectId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      this.cachedProjects = this.cachedProjects.filter((p) => p.id !== projectId);
    } catch (e) {
      console.error('Failed to delete project from IndexedDB', e);
    }
  }

  /**
   * Favorites management (persisted in localStorage as lightweight JSON array)
   */
  public static getFavorites(): string[] {
    try {
      if (typeof localStorage === 'undefined') return ['film-kodachrome', 'cine-gold500t', 'mono-noir'];
      const data = localStorage.getItem(FAVORITES_STORAGE_KEY);
      return data ? JSON.parse(data) : ['film-kodachrome', 'cine-gold500t', 'mono-noir'];
    } catch {
      return ['film-kodachrome', 'cine-gold500t', 'mono-noir'];
    }
  }

  public static toggleFavorite(presetId: string): string[] {
    try {
      const favorites = this.getFavorites();
      const next = favorites.includes(presetId)
        ? favorites.filter((id) => id !== presetId)
        : [...favorites, presetId];
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    } catch {
      return [];
    }
  }

  /**
   * Settings management (persisted in localStorage as lightweight JSON object)
   */
  public static getSettings(): AppSettings {
    try {
      if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS;
      const data = localStorage.getItem(SETTINGS_STORAGE_KEY);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  public static saveSettings(settings: AppSettings): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      }
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }

  /**
   * Calculate storage usage in MB across IndexedDB and localStorage
   */
  public static async getEstimatedStorageMB(): Promise<number> {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage !== undefined) {
          return +(estimate.usage / (1024 * 1024)).toFixed(2);
        }
      }
    } catch {
      // Fallback
    }
    return 0.25;
  }

  /**
   * Clears IndexedDB project and image stores and clears legacy cache
   */
  public static async clearCache(): Promise<void> {
    try {
      const db = await this.openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_PROJECTS, STORE_IMAGES], 'readwrite');
        tx.objectStore(STORE_PROJECTS).clear();
        tx.objectStore(STORE_IMAGES).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      this.cachedProjects = [];
    } catch (e) {
      console.error('Failed to clear IndexedDB stores', e);
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(PROJECTS_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }
}

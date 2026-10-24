import { Project } from '../types/editor';

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

export class StorageService {
  /**
   * Retrieves all saved projects
   */
  static getProjects(): Project[] {
    try {
      const data = localStorage.getItem(PROJECTS_STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load projects from storage', e);
      return [];
    }
  }

  /**
   * Saves or updates a project
   */
  static saveProject(project: Project): void {
    try {
      const projects = this.getProjects();
      const existingIdx = projects.findIndex((p) => p.id === project.id);
      if (existingIdx >= 0) {
        projects[existingIdx] = { ...project, updatedAt: Date.now() };
      } else {
        projects.unshift({ ...project, createdAt: Date.now(), updatedAt: Date.now() });
      }
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
      console.error('Failed to save project to storage', e);
    }
  }

  /**
   * Deletes a project by ID
   */
  static deleteProject(projectId: string): void {
    try {
      const projects = this.getProjects().filter((p) => p.id !== projectId);
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
      console.error('Failed to delete project', e);
    }
  }

  /**
   * Get favorite preset IDs
   */
  static getFavorites(): string[] {
    try {
      const data = localStorage.getItem(FAVORITES_STORAGE_KEY);
      return data ? JSON.parse(data) : ['film-kodachrome', 'cine-gold500t', 'mono-noir'];
    } catch {
      return ['film-kodachrome', 'cine-gold500t', 'mono-noir'];
    }
  }

  /**
   * Toggle a preset as favorite
   */
  static toggleFavorite(presetId: string): string[] {
    try {
      const favorites = this.getFavorites();
      const next = favorites.includes(presetId)
        ? favorites.filter((id) => id !== presetId)
        : [...favorites, presetId];
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
      return next;
    } catch {
      return [];
    }
  }

  /**
   * Settings
   */
  static getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(SETTINGS_STORAGE_KEY);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  static saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }

  /**
   * Calculate local storage usage in MB
   */
  static getEstimatedStorageMB(): number {
    try {
      let total = 0;
      for (const key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
          total += (localStorage[key].length * 2); // approximate 2 bytes per UTF-16 char
        }
      }
      return +(total / (1024 * 1024)).toFixed(2);
    } catch {
      return 0.12;
    }
  }

  /**
   * Clear cache
   */
  static clearCache(): void {
    try {
      localStorage.removeItem(PROJECTS_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear cache', e);
    }
  }
}

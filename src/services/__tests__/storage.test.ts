import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService, dataURLToBlob } from '../storage';
import type { Project } from '../../types/editor';
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_CURVES,
  DEFAULT_GEOMETRY,
  DEFAULT_WHEELS,
} from '../../constants/defaults';

// Ensure in-memory localStorage for Node testing environments
if (typeof globalThis.localStorage === 'undefined') {
  const memStore = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => memStore.get(key) ?? null,
    setItem: (key: string, val: string) => memStore.set(key, String(val)),
    removeItem: (key: string) => memStore.delete(key),
    clear: () => memStore.clear(),
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
  });
}

describe('StorageService: IndexedDB & Migration', () => {
  beforeEach(async () => {
    // Clear localStorage and IndexedDB before each test
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    await StorageService.clearCache();
  });

  it('dataURLToBlob correctly converts base64 image string to binary Blob', () => {
    // 1x1 transparent png data url
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const blob = dataURLToBlob(dataUrl);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('saves and retrieves a project in IndexedDB', async () => {
    const mockProject: Project = {
      id: 'proj-test-1',
      name: 'Test Photo',
      imageSrc: 'https://images.unsplash.com/photo-test',
      originalName: 'test.jpg',
      width: 1920,
      height: 1080,
      fileSize: 500000,
      createdAt: 1000,
      updatedAt: 2000,
      adjustments: { ...DEFAULT_ADJUSTMENTS, exposure: 0.5 },
      activePresetId: null,
      presetIntensity: 100,
      geometry: DEFAULT_GEOMETRY,
      curves: DEFAULT_CURVES,
      wheels: DEFAULT_WHEELS,
    };

    const mockBlob = new Blob(['fake image binary data'], { type: 'image/jpeg' });
    await StorageService.saveProject(mockProject, mockBlob);

    const projects = await StorageService.getProjects();
    expect(projects.length).toBe(1);
    expect(projects[0].id).toBe('proj-test-1');
    expect(projects[0].adjustments.exposure).toBe(0.5);

    const savedBlob = await StorageService.getImageBlob('proj-test-1');
    expect(savedBlob).not.toBeNull();
    expect(savedBlob?.type).toBe('image/jpeg');
  });

  it('deletes a project and its image from IndexedDB', async () => {
    const mockProject: Project = {
      id: 'proj-del-1',
      name: 'To Delete',
      imageSrc: '',
      originalName: 'del.jpg',
      width: 800,
      height: 600,
      fileSize: 100000,
      createdAt: 1000,
      updatedAt: 1000,
      adjustments: DEFAULT_ADJUSTMENTS,
      activePresetId: null,
      presetIntensity: 100,
      geometry: DEFAULT_GEOMETRY,
      curves: DEFAULT_CURVES,
      wheels: DEFAULT_WHEELS,
    };

    await StorageService.saveProject(mockProject);
    let projects = await StorageService.getProjects();
    expect(projects.length).toBe(1);

    await StorageService.deleteProject('proj-del-1');
    projects = await StorageService.getProjects();
    expect(projects.length).toBe(0);
  });

  it('migrates legacy projects from localStorage into IndexedDB and cleans legacy key', async () => {
    const legacyProject: Project = {
      id: 'proj-legacy-1',
      name: 'Legacy Project',
      // Base64 data url
      imageSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      originalName: 'legacy.png',
      width: 1200,
      height: 800,
      fileSize: 2048,
      createdAt: 500,
      updatedAt: 600,
      adjustments: { ...DEFAULT_ADJUSTMENTS, contrast: 25 },
      activePresetId: 'film-kodachrome',
      presetIntensity: 80,
      geometry: DEFAULT_GEOMETRY,
      curves: DEFAULT_CURVES,
      wheels: DEFAULT_WHEELS,
    };

    localStorage.setItem('chroma_studio_projects', JSON.stringify([legacyProject]));

    const result = await StorageService.migrateLegacyLocalStorage();
    expect(result.migratedCount).toBe(1);

    // Verify localStorage key is cleaned
    expect(localStorage.getItem('chroma_studio_projects')).toBeNull();

    // Verify project is now in IndexedDB
    const projects = await StorageService.getProjects();
    expect(projects.length).toBe(1);
    expect(projects[0].id).toBe('proj-legacy-1');
    expect(projects[0].adjustments.contrast).toBe(25);

    // Verify image was extracted and saved as binary blob
    const blob = await StorageService.getImageBlob('proj-legacy-1');
    expect(blob).not.toBeNull();
    expect(blob?.type).toBe('image/png');
  });

  it('manages favorites and settings cleanly', () => {
    const initial = StorageService.getFavorites();
    expect(initial).toContain('film-kodachrome');

    const toggled = StorageService.toggleFavorite('custom-look');
    expect(toggled).toContain('custom-look');

    const settings = StorageService.getSettings();
    expect(settings.defaultFormat).toBe('jpeg');

    StorageService.saveSettings({ ...settings, defaultFormat: 'webp' });
    expect(StorageService.getSettings().defaultFormat).toBe('webp');
  });
});

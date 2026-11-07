import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from '../storage';
import { ExportService, blobToBase64 } from '../exportService';
import { CloudProjectService, FREE_PLAN_LIMITS, PRO_PLAN_LIMITS } from '../cloudProjectService';
import type { Project } from '../../types/editor';
import { DEFAULT_ADJUSTMENTS, DEFAULT_CURVES, DEFAULT_GEOMETRY, DEFAULT_WHEELS } from '../../constants/defaults';

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

describe('User-Specific Cloud Storage & Multi-User Isolation', () => {
  beforeEach(async () => {
    localStorage.clear();
    await StorageService.clearCache();
  });

  it('strictly isolates projects between different user accounts', async () => {
    const projectUserA: Project = {
      id: 'proj-user-a',
      name: 'Project Alice',
      imageSrc: 'blob:alice-image',
      originalName: 'alice.jpg',
      width: 1920,
      height: 1080,
      fileSize: 200000,
      createdAt: 1000,
      updatedAt: 1000,
      adjustments: DEFAULT_ADJUSTMENTS,
      activePresetId: null,
      presetIntensity: 100,
      geometry: DEFAULT_GEOMETRY,
      curves: DEFAULT_CURVES,
      wheels: DEFAULT_WHEELS,
      userId: 'user-uuid-alice',
    };

    const projectUserB: Project = {
      id: 'proj-user-b',
      name: 'Project Bob',
      imageSrc: 'blob:bob-image',
      originalName: 'bob.jpg',
      width: 1920,
      height: 1080,
      fileSize: 400000,
      createdAt: 2000,
      updatedAt: 2000,
      adjustments: DEFAULT_ADJUSTMENTS,
      activePresetId: null,
      presetIntensity: 100,
      geometry: DEFAULT_GEOMETRY,
      curves: DEFAULT_CURVES,
      wheels: DEFAULT_WHEELS,
      userId: 'user-uuid-bob',
    };

    await StorageService.saveProject(projectUserA);
    await StorageService.saveProject(projectUserB);

    // Alice queries her projects
    StorageService.setCurrentUser('user-uuid-alice');
    const aliceProjects = await StorageService.getProjects('user-uuid-alice');
    expect(aliceProjects.length).toBe(1);
    expect(aliceProjects[0].id).toBe('proj-user-a');
    expect(aliceProjects[0].name).toBe('Project Alice');

    // Bob queries his projects
    StorageService.setCurrentUser('user-uuid-bob');
    const bobProjects = await StorageService.getProjects('user-uuid-bob');
    expect(bobProjects.length).toBe(1);
    expect(bobProjects[0].id).toBe('proj-user-b');
    expect(bobProjects[0].name).toBe('Project Bob');

    // Unauthenticated guest should not see Alice or Bob's projects
    StorageService.setCurrentUser(null);
    const guestProjects = await StorageService.getProjects(null);
    expect(guestProjects.find((p) => p.userId === 'user-uuid-alice')).toBeUndefined();
    expect(guestProjects.find((p) => p.userId === 'user-uuid-bob')).toBeUndefined();
  });

  it('onUserSignOut purges in-memory caches and clears active session state', async () => {
    StorageService.setCurrentUser('user-test-signout');
    await StorageService.onUserSignOut();
    expect(StorageService.getCurrentUser()).toBeNull();
    const projs = StorageService.getProjectsSync(null);
    expect(projs.length).toBe(0);
  });
});

describe('Cloud Quota Constraints & Plan Limits', () => {
  it('enforces free plan limits: 3 cloud projects and 100 MB', () => {
    expect(FREE_PLAN_LIMITS.maxProjects).toBe(3);
    expect(FREE_PLAN_LIMITS.maxBytes).toBe(100 * 1024 * 1024);
  });

  it('enforces pro plan limits: unlimited projects and 10 GB', () => {
    expect(PRO_PLAN_LIMITS.maxProjects).toBe(Infinity);
    expect(PRO_PLAN_LIMITS.maxBytes).toBe(10 * 1024 * 1024 * 1024);
  });
});

describe('ExportService: Universal Native & Web Export Pipeline', () => {
  it('rejects empty or zero-byte blobs gracefully', async () => {
    const emptyBlob = new Blob([], { type: 'image/jpeg' });
    const result = await ExportService.saveExportedFile(emptyBlob, 'empty.jpg');
    expect(result.success).toBe(false);
    expect(result.error).toContain('generated image is empty or invalid');
  });

  it('blobToBase64 correctly converts binary blob to base64 string', async () => {
    const testText = 'Hello Chroma Studio Export';
    const blob = new Blob([testText], { type: 'text/plain' });
    const base64 = await blobToBase64(blob);
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(0);
    // Decode base64 and verify
    const decoded = atob(base64);
    expect(decoded).toBe(testText);
  });

  it('exportProjectAsJson exports well-structured JSON project backup', async () => {
    const mockProj: Project = {
      id: 'proj-export-json',
      name: 'Backup Project',
      imageSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      originalName: 'test.png',
      width: 100,
      height: 100,
      fileSize: 1000,
      createdAt: 1000,
      updatedAt: 1000,
      adjustments: DEFAULT_ADJUSTMENTS,
      activePresetId: null,
      presetIntensity: 100,
      geometry: DEFAULT_GEOMETRY,
      curves: DEFAULT_CURVES,
      wheels: DEFAULT_WHEELS,
      userId: 'user-export-test',
    };

    // Spy on saveExportedFile
    const spy = vi.spyOn(ExportService, 'saveExportedFile').mockResolvedValue({
      success: true,
      method: 'browser_download',
    });

    const result = await ExportService.exportProjectAsJson(mockProj);
    expect(result.success).toBe(true);
    expect(spy).toHaveBeenCalledOnce();
    const calledBlob = spy.mock.calls[0][0];
    const calledFileName = spy.mock.calls[0][1];
    expect(calledFileName).toBe('Backup_Project_backup.json');
    expect(calledBlob.type).toBe('application/json');

    spy.mockRestore();
  });
});

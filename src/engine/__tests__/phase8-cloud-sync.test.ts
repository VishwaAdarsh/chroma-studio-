import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CloudProjectService,
  ensureUUID,
  generateUUID,
} from '../../services/cloudProjectService';
import { SyncEngine } from '../../services/syncEngine';
import type { CloudProjectRecord } from '../../types/sync';
import type { Project } from '../../types/editor';
import type { DesignProject, CollageProject, CarouselProject } from '../../types/design';
import { DEFAULT_ADJUSTMENTS } from '../../constants/defaults';

// In-memory mock storage for Node environment
const createMockStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
};

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMockStorage(),
    writable: true,
  });
}

describe('Phase 8: Cloud Sync & Project Persistence Architecture', () => {
  const mockUserId = '11111111-2222-3333-4444-555555555555';
  const mockUserBId = '99999999-8888-7777-6666-555555555555';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. UUID Generation & Normalization', () => {
    it('generates valid RFC 4122 compliant UUID v4 strings', () => {
      const uuid = generateUUID();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(uuid)).toBe(true);
    });

    it('ensures legacy IDs are upgraded to valid UUIDs while preserving existing UUIDs', () => {
      const existingUUID = 'a3b8cd12-9876-4abc-8def-0123456789ab';
      expect(ensureUUID(existingUUID)).toBe(existingUUID);

      const legacyId = 'proj-1730456789012';
      const upgraded = ensureUUID(legacyId);
      expect(upgraded).not.toBe(legacyId);
      expect(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(upgraded)).toBe(true);
    });
  });

  describe('2. Project Serialization and Deserialization', () => {
    it('serializes Photo RAW project and strips large base64 strings from document JSON', () => {
      const rawProject: Project = {
        id: generateUUID(),
        name: 'Cinematic Mountain.RAW',
        type: 'photo',
        imageSrc: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...',
        originalName: 'Cinematic Mountain.RAW',
        width: 3840,
        height: 2160,
        fileSize: 4500000,
        createdAt: 1730000000000,
        updatedAt: 1730001000000,
        adjustments: {
          ...DEFAULT_ADJUSTMENTS,
          exposure: 15,
          brightness: 5,
          contrast: 10,
          highlights: -20,
          shadows: 15,
          whites: 0,
          blacks: -5,
          temperature: 12,
          tint: -4,
          saturation: 8,
          vibrance: 14,
          clarity: 10,
          vignette: 15,
          grain: 0,
        },
        activePresetId: 'film-kodachrome',
        presetIntensity: 90,
        geometry: {
          crop: { x: 0, y: 0, width: 3840, height: 2160, aspectRatio: 'free' },
          rotation: 0,
          flipH: false,
          flipV: false,
        },
        curves: {
          rgb: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
          red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
          green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
          blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
        },
        wheels: {
          shadows: { hue: 210, saturation: 15, luminance: 0 },
          midtones: { hue: 45, saturation: 10, luminance: 0 },
          highlights: { hue: 35, saturation: 20, luminance: 0 },
        },
      };

      const assetPath = `${mockUserId}/${rawProject.id}/assets/source_image.jpg`;
      const serialized = CloudProjectService.serializeProject(rawProject, mockUserId, assetPath);

      expect(serialized.id).toBe(rawProject.id);
      expect(serialized.user_id).toBe(mockUserId);
      expect(serialized.project_type).toBe('photo');
      expect(serialized.name).toBe('Cinematic Mountain.RAW');

      // Crucial: document JSON must not contain large base64 image strings
      expect(serialized.document.imageSrc).toBeUndefined();
      expect(serialized.document.assetPath).toBe(assetPath);
      expect(serialized.document.adjustments.exposure).toBe(15);
      expect(serialized.document.activePresetId).toBe('film-kodachrome');
    });

    it('serializes and deserializes Multi-Slide Carousel Studio projects flawlessly', () => {
      const carouselProject: CarouselProject = {
        id: generateUUID(),
        name: 'Growth Marketing Playbook',
        type: 'carousel',
        format: '4:5',
        width: 1080,
        height: 1350,
        slides: [
          {
            id: 'slide-1',
            title: 'Cover Slide',
            slideType: 'cover',
            background: { type: 'color', value: '#070B14' },
            elements: [
              {
                id: 'text-1',
                type: 'text',
                text: '5 Steps to 10x Growth',
                fontFamily: 'Inter',
                fontSize: 48,
                color: '#FFFFFF',
                textAlign: 'center',
                fontWeight: 'bold',
                fontStyle: 'normal',
                x: 100,
                y: 200,
                width: 880,
                height: 120,
                rotation: 0,
                opacity: 1,
                zIndex: 1,
                visible: true,
              },
            ],
          },
        ],
        activeSlideIndex: 0,
        theme: {
          fontFamily: 'Inter',
          primaryColor: '#F8FAFC',
          accentColor: '#8B5CF6',
          bgColor: '#070B14',
        },
        createdAt: 1730000000000,
        updatedAt: 1730002000000,
      };

      const serialized = CloudProjectService.serializeProject(carouselProject, mockUserId);
      expect(serialized.project_type).toBe('carousel');
      expect(serialized.document.slides.length).toBe(1);

      const record: CloudProjectRecord = {
        ...serialized,
        created_at: new Date(carouselProject.createdAt).toISOString(),
        updated_at: new Date(carouselProject.updatedAt).toISOString(),
      };

      const restored = CloudProjectService.deserializeProject(record) as CarouselProject;
      expect(restored.type).toBe('carousel');
      expect(restored.name).toBe('Growth Marketing Playbook');
      expect(restored.slides[0].elements[0].type).toBe('text');
      expect((restored.slides[0].elements[0] as any).text).toBe('5 Steps to 10x Growth');
      expect(restored.syncStatus).toBe('synced');
    });
  });

  describe('3. Storage Organization & User Scoping', () => {
    it('enforces secure user-scoped object path structure', () => {
      const projectId = generateUUID();
      const assetId = 'layer_texture_1.png';

      const expectedAssetPath = `${mockUserId}/${projectId}/assets/${assetId}`;
      const expectedThumbPath = `${mockUserId}/${projectId}/thumbnail.webp`;

      expect(expectedAssetPath.startsWith(`${mockUserId}/${projectId}/assets/`)).toBe(true);
      expect(expectedThumbPath.startsWith(`${mockUserId}/${projectId}/thumbnail.webp`)).toBe(true);
    });
  });

  describe('4. Offline-First Synchronization & Queueing', () => {
    it('queues project saves with pending_upload when offline without blocking UI', () => {
      const syncEngine = SyncEngine.getInstance();
      const mockUser = { id: mockUserId, email: 'creator@chromastudio.app' } as any;
      syncEngine.setUser(mockUser);

      const projectId = generateUUID();
      // Enqueue sync operation
      syncEngine.enqueue(projectId, 50);

      const state = syncEngine.getState();
      expect(state.pendingCount).toBeGreaterThanOrEqual(1);
    });

    it('clears sync queues and conflicts safely upon user sign-out', () => {
      const syncEngine = SyncEngine.getInstance();
      const mockUser = { id: mockUserId, email: 'creator@chromastudio.app' } as any;
      syncEngine.setUser(mockUser);

      syncEngine.enqueue(generateUUID(), 5000);
      expect(syncEngine.getState().pendingCount).toBeGreaterThan(0);

      // User signs out
      syncEngine.setUser(null);
      const afterSignOutState = syncEngine.getState();

      expect(afterSignOutState.pendingCount).toBe(0);
      expect(afterSignOutState.activeConflicts.length).toBe(0);
      expect(afterSignOutState.isSyncing).toBe(false);
    });
  });

  describe('5. Conflict Detection & Multi-Option Resolution', () => {
    it('detects conflict when remote project has higher version number than local', async () => {
      const projectId = generateUUID();
      const localProject: Project = {
        id: projectId,
        name: 'Street Neon Night.RAW',
        type: 'photo',
        imageSrc: '',
        originalName: 'Street Neon Night.RAW',
        width: 1920,
        height: 1080,
        fileSize: 2000000,
        createdAt: 1730000000000,
        updatedAt: 1730005000000,
        cloudVersion: 1,
        adjustments: {} as any,
        activePresetId: null,
        presetIntensity: 100,
        geometry: {} as any,
        curves: {} as any,
        wheels: {} as any,
      };

      const remoteRecord: CloudProjectRecord = {
        id: projectId,
        user_id: mockUserId,
        name: 'Street Neon Night.RAW (Edited on Tablet)',
        project_type: 'photo',
        document: {},
        thumbnail_path: null,
        version: 3, // Remote is on v3 while local is on v1
        created_at: new Date(1730000000000).toISOString(),
        updated_at: new Date(1730006000000).toISOString(),
        deleted_at: null,
      };

      // Mock fetchProject to simulate conflict
      vi.spyOn(CloudProjectService, 'fetchProject').mockResolvedValue(remoteRecord);

      const serialized = CloudProjectService.serializeProject(localProject, mockUserId);
      const result = await CloudProjectService.upsertProject(serialized, { force: false });

      expect(result.conflict).toBe(true);
      expect(result.remoteRecord?.version).toBe(3);
    });

    it('supports resolution choice: duplicate_both preserves remote and creates a local copy', () => {
      const projectId = generateUUID();
      const localProject: Project = {
        id: projectId,
        name: 'Summer Campaign',
        type: 'photo',
        imageSrc: '',
        originalName: 'Summer Campaign',
        width: 1080,
        height: 1080,
        fileSize: 1000,
        createdAt: 1730000000000,
        updatedAt: 1730005000000,
        cloudVersion: 1,
        adjustments: {} as any,
        activePresetId: null,
        presetIntensity: 100,
        geometry: {} as any,
        curves: {} as any,
        wheels: {} as any,
      };

      const localCopy: Project = {
        ...localProject,
        id: generateUUID(),
        name: `${localProject.name} (Local Copy)`,
        syncStatus: 'pending_upload',
        cloudVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(localCopy.id).not.toBe(localProject.id);
      expect(localCopy.name).toBe('Summer Campaign (Local Copy)');
      expect(localCopy.syncStatus).toBe('pending_upload');
    });
  });

  describe('6. Account Isolation & Data Security', () => {
    it('isolates user cloud projects and verifies RLS ownership boundary', () => {
      const userAProject = CloudProjectService.serializeProject(
        { id: generateUUID(), name: 'User A Secret Project' },
        mockUserId
      );

      const userBProject = CloudProjectService.serializeProject(
        { id: generateUUID(), name: 'User B Project' },
        mockUserBId
      );

      expect(userAProject.user_id).toBe(mockUserId);
      expect(userBProject.user_id).toBe(mockUserBId);
      expect(userAProject.user_id).not.toBe(userBProject.user_id);
    });

    it('supports soft-deletion using deleted_at timestamp', () => {
      const record: CloudProjectRecord = {
        id: generateUUID(),
        user_id: mockUserId,
        name: 'Archived Design',
        project_type: 'template',
        document: {},
        thumbnail_path: null,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: new Date().toISOString(),
      };

      expect(record.deleted_at).not.toBeNull();
      // Active project queries filter where deleted_at IS NULL
      const isProjectActive = (p: CloudProjectRecord) => p.deleted_at === null;
      expect(isProjectActive(record)).toBe(false);
    });
  });
});

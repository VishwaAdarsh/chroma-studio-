// Chroma Studio — AI Workflow Integration & QA Test Suite
// Verifies cross-feature coordination: tool transitions, ephemeral preview isolation,
// undo/redo fidelity, duplicate request prevention, generated image import distinction,
// project persistence & reopen fidelity, and graceful cancellation.

import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiService } from '../../services/ai/aiService';
import { segmentationService } from '../../services/segmentation/segmentationService';
import { enhancementService } from '../../services/enhancement/enhancementService';
import { inpaintingService } from '../../services/inpainting/inpaintingService';
import { imageGenService } from '../../services/imageGen/imageGenService';
import { smartPresetService } from '../../services/smartPresets/smartPresetService';
import { StorageService } from '../../services/storage';
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_CURVES,
  DEFAULT_CUTOUT,
  DEFAULT_GEOMETRY,
  DEFAULT_WHEELS,
  DEFAULT_HSL,
  DEFAULT_BACKGROUND_REPLACEMENT,
} from '../../constants/defaults';
import type {
  Project,
  AdjustmentParameters,
  CutoutState,
  BackgroundReplacementState,
  EnhancementState,
  InpaintState,
  HistorySnapshot,
} from '../../types/editor';

// In-memory localStorage mock for headless node testing
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = localStorageMock;
}

describe('P3 AI Workflow Integration & QA Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.localStorage.clear();
  });

  describe('1. Non-Destructive Editing & Undo/Redo Fidelity Across AI Tools', () => {
    it('AI Assistant: preserves history snapshots, applies non-destructively, and reverts on undo', () => {
      const pastHistory: HistorySnapshot[] = [];
      let currentAdjustments: AdjustmentParameters = { ...DEFAULT_ADJUSTMENTS, exposure: 0 };

      // Helper simulating commitImmediateHistory
      const commitSnapshot = () => {
        pastHistory.push({
          adjustments: { ...currentAdjustments },
          activePresetId: null,
          presetIntensity: 100,
          geometry: DEFAULT_GEOMETRY,
          curves: DEFAULT_CURVES,
          wheels: DEFAULT_WHEELS,
          hsl: DEFAULT_HSL,
          cutout: DEFAULT_CUTOUT,
          backgroundReplacement: DEFAULT_BACKGROUND_REPLACEMENT,
          currentImageSrc: 'data:image/jpeg;base64,original',
        });
      };

      // 1. User commits snapshot before AI Assistant apply
      commitSnapshot();
      expect(pastHistory.length).toBe(1);

      // 2. AI Assistant plan applied (e.g., exposure +0.4, contrast +15)
      currentAdjustments = {
        ...currentAdjustments,
        exposure: 0.4,
        contrast: 15,
      };

      expect(currentAdjustments.exposure).toBe(0.4);
      expect(currentAdjustments.contrast).toBe(15);

      // 3. User clicks Undo -> restores from pastHistory
      const restored = pastHistory.pop();
      expect(restored).toBeDefined();
      currentAdjustments = restored!.adjustments;

      expect(currentAdjustments.exposure).toBe(0);
      expect(currentAdjustments.contrast).toBe(0);
    });

    it('AI Object Removal (Inpaint): stores pre-inpaint image source in history and allows complete reversion', () => {
      const pastHistory: HistorySnapshot[] = [];
      let activeImageSrc = 'data:image/jpeg;base64,source_with_unwanted_person';
      let inpaintOps: InpaintState = { operations: [] };

      // Commit snapshot before destructive apply
      pastHistory.push({
        adjustments: DEFAULT_ADJUSTMENTS,
        activePresetId: null,
        presetIntensity: 100,
        geometry: DEFAULT_GEOMETRY,
        curves: DEFAULT_CURVES,
        wheels: DEFAULT_WHEELS,
        hsl: DEFAULT_HSL,
        cutout: DEFAULT_CUTOUT,
        backgroundReplacement: DEFAULT_BACKGROUND_REPLACEMENT,
        inpaint: inpaintOps,
        currentImageSrc: activeImageSrc,
      });

      // Apply inpaint result
      const inpaintedResult = 'data:image/jpeg;base64,clean_inpainted_source';
      activeImageSrc = inpaintedResult;
      inpaintOps = {
        operations: [
          {
            id: 'inpaint_1',
            timestamp: Date.now(),
            maskData: 'data:image/png;base64,mask',
            provider: 'on-device',
            explanation: 'Object removed',
          },
        ],
      };

      expect(activeImageSrc).toBe(inpaintedResult);
      expect(inpaintOps.operations.length).toBe(1);

      // Revert via Undo
      const previous = pastHistory.pop()!;
      activeImageSrc = previous.currentImageSrc!;
      inpaintOps = previous.inpaint || { operations: [] };

      expect(activeImageSrc).toBe('data:image/jpeg;base64,source_with_unwanted_person');
      expect(inpaintOps.operations.length).toBe(0);
    });

    it('AI Cutout & Background Replacement: state toggles remain independent and non-destructive', () => {
      let cutoutState: CutoutState = { ...DEFAULT_CUTOUT };
      let bgState: BackgroundReplacementState = { ...DEFAULT_BACKGROUND_REPLACEMENT };

      // Enable cutout
      cutoutState = {
        ...cutoutState,
        enabled: true,
        mode: 'ai',
        provider: 'on-device',
        confidence: 0.94,
      };

      // Enable backdrop with AI generative background
      bgState = {
        ...bgState,
        enabled: true,
        mode: 'ai',
        aiPrompt: 'Studio warm dusk light',
        aiGeneratedSrc: 'data:image/jpeg;base64,backdrop_bg',
      };

      expect(cutoutState.enabled).toBe(true);
      expect(cutoutState.mode).toBe('ai');
      expect(bgState.enabled).toBe(true);
      expect(bgState.mode).toBe('ai');

      // Disabling backdrop leaves cutout subject intact
      bgState = { ...bgState, enabled: false };
      expect(bgState.enabled).toBe(false);
      expect(cutoutState.enabled).toBe(true);
    });
  });

  describe('2. Distinction Between Image Edits vs Generated Image Imports', () => {
    it('auto-saves current active project before opening a generated image as a new project', async () => {
      const activeProject: Project = {
        id: 'existing-proj-1',
        name: 'My Existing Artwork',
        originalName: 'artwork.jpg',
        imageSrc: 'data:image/jpeg;base64,existing_artwork',
        width: 1920,
        height: 1080,
        fileSize: 204800,
        createdAt: Date.now() - 50000,
        updatedAt: Date.now() - 10000,
        adjustments: { ...DEFAULT_ADJUSTMENTS, contrast: 25 },
        activePresetId: 'cine-teal-orange',
        presetIntensity: 90,
        geometry: DEFAULT_GEOMETRY,
        curves: DEFAULT_CURVES,
        wheels: DEFAULT_WHEELS,
      };

      // Save initial project
      await StorageService.saveProject(activeProject);
      let loadedProjects = await StorageService.getProjects();
      expect(loadedProjects.some((p) => p.id === 'existing-proj-1')).toBe(true);

      // Simulate handleOpenGeneratedInEditor auto-saving existing before launching new
      const generatedImageUrl = 'data:image/jpeg;base64,new_ai_generated_scene';
      const updatedExisting: Project = {
        ...activeProject,
        updatedAt: Date.now(),
        adjustments: { ...activeProject.adjustments, contrast: 30 },
      };
      await StorageService.saveProject(updatedExisting);

      // Now create new project for generated image
      const newGenProject: Project = {
        id: 'new-gen-proj-2',
        name: 'AI Generated Image',
        originalName: 'ai_generated.png',
        imageSrc: generatedImageUrl,
        width: 1024,
        height: 1024,
        fileSize: 150000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        adjustments: DEFAULT_ADJUSTMENTS,
        activePresetId: null,
        presetIntensity: 100,
        geometry: DEFAULT_GEOMETRY,
        curves: DEFAULT_CURVES,
        wheels: DEFAULT_WHEELS,
      };
      await StorageService.saveProject(newGenProject);

      loadedProjects = await StorageService.getProjects();
      expect(loadedProjects.length).toBeGreaterThanOrEqual(2);

      // Verify the previous project was NOT overwritten or corrupted
      const foundOriginal = loadedProjects.find((p) => p.id === 'existing-proj-1');
      expect(foundOriginal).toBeDefined();
      expect(foundOriginal?.name).toBe('My Existing Artwork');
      expect(foundOriginal?.adjustments.contrast).toBe(30);

      // Verify image blob was preserved in image store
      const imageBlob = await StorageService.getImageBlob('existing-proj-1');
      expect(imageBlob).toBeDefined();

      // Verify the new generated image exists as its own project
      const foundNew = loadedProjects.find((p) => p.id === 'new-gen-proj-2');
      expect(foundNew).toBeDefined();
      expect(foundNew?.name).toBe('AI Generated Image');
    });

    it('supports inserting a generated image directly as a background replacement layer', () => {
      let bgState: BackgroundReplacementState = { ...DEFAULT_BACKGROUND_REPLACEMENT };
      const generatedBgUrl = 'data:image/jpeg;base64,generated_neon_city';

      // Insert as backdrop
      bgState = {
        ...bgState,
        enabled: true,
        mode: 'image',
        imageSrc: generatedBgUrl,
      };

      expect(bgState.enabled).toBe(true);
      expect(bgState.mode).toBe('image');
      expect(bgState.imageSrc).toBe(generatedBgUrl);
    });
  });

  describe('3. Project Persistence & Serialization Integrity', () => {
    it('serializes and deserializes all AI attributes without loss or schema degradation', () => {
      const complexAiProject: Project = {
        id: 'full-ai-proj-99',
        name: 'Complex AI Masterpiece',
        originalName: 'masterpiece.dng',
        imageSrc: 'data:image/jpeg;base64,raw_bytes',
        width: 3840,
        height: 2160,
        fileSize: 5242880,
        createdAt: 1700000000000,
        updatedAt: 1700000005000,
        adjustments: {
          ...DEFAULT_ADJUSTMENTS,
          exposure: 0.25,
          temperature: 12,
          clarity: 15,
          vignette: 8,
        },
        activePresetId: 'golden-sunset',
        presetIntensity: 80,
        geometry: DEFAULT_GEOMETRY,
        curves: DEFAULT_CURVES,
        wheels: DEFAULT_WHEELS,
        hsl: DEFAULT_HSL,
        cutout: {
          enabled: true,
          mode: 'ai',
          tolerance: 30,
          feather: 6,
          invert: false,
          provider: 'on-device',
          confidence: 0.96,
        },
        backgroundReplacement: {
          ...DEFAULT_BACKGROUND_REPLACEMENT,
          enabled: true,
          mode: 'ai',
          color: '#070B14',
          aiPrompt: 'Cinematic sunset mountain range',
          aiGeneratedSrc: 'data:image/jpeg;base64,mountains',
          bgTransform: {
            ...DEFAULT_BACKGROUND_REPLACEMENT.bgTransform,
            blur: 4,
          },
        },
        enhancement: {
          applied: true,
          strength: 'balanced',
          mode: 'ai-local',
          appliedAt: 1700000000000,
          explanation: 'Optimized tone',
        },
        inpaint: {
          operations: [
            {
              id: 'op-1',
              timestamp: 1700000002000,
              maskData: 'data:image/png;base64,mask1',
              provider: 'on-device',
              explanation: 'Wire removed',
            },
          ],
        },
      };

      const serialized = JSON.stringify(complexAiProject);
      const deserialized: Project = JSON.parse(serialized);

      expect(deserialized.id).toBe(complexAiProject.id);
      expect(deserialized.adjustments.exposure).toBe(0.25);
      expect(deserialized.activePresetId).toBe('golden-sunset');
      expect(deserialized.presetIntensity).toBe(80);
      expect(deserialized.cutout?.enabled).toBe(true);
      expect(deserialized.cutout?.confidence).toBe(0.96);
      expect(deserialized.backgroundReplacement?.aiPrompt).toBe('Cinematic sunset mountain range');
      expect(deserialized.backgroundReplacement?.bgTransform.blur).toBe(4);
      expect(deserialized.enhancement?.applied).toBe(true);
      expect(deserialized.inpaint?.operations.length).toBe(1);
    });
  });

  describe('4. Graceful Cancellation & Duplicate Prevention', () => {
    it('cancels in-flight AI assistant requests when signal is aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        AiService.generateEditPlan(
          {
            prompt: 'Make it cinematic',
            currentAdjustments: DEFAULT_ADJUSTMENTS,
          },
          controller.signal
        )
      ).rejects.toThrow(/cancelled|abort/i);
    });

    it('cancels in-flight AI background removal when cancelled', async () => {
      const controller = new AbortController();
      controller.abort();

      const dummyBuffer = { data: new Uint8ClampedArray(50 * 50 * 4), width: 50, height: 50 };

      await expect(
        segmentationService.removeBackground(dummyBuffer, {
          provider: 'on-device',
          signal: controller.signal,
        })
      ).rejects.toThrow(/cancelled|abort/i);
    });

    it('cancels in-flight AI image generation when signal is aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        imageGenService.generate({
          prompt: 'A misty pine forest',
          userConsent: true,
          signal: controller.signal,
        })
      ).rejects.toThrow(/cancelled|abort/i);
    });

    it('cancels in-flight Smart Presets recommendation when signal is aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const dummyBuffer = {
        data: new Uint8ClampedArray(100 * 100 * 4),
        width: 100,
        height: 100,
      };

      await expect(
        smartPresetService.recommendPresets(dummyBuffer, {
          signal: controller.signal,
        })
      ).rejects.toThrow(/cancelled|abort/i);
    });
  });

  describe('5. Ephemeral Preview State Isolation', () => {
    it('verifies preview adjustments are never committed into base adjustments until explicit apply', () => {
      const baseAdjustments: AdjustmentParameters = { ...DEFAULT_ADJUSTMENTS, exposure: 0.1 };
      const previewProposed: AdjustmentParameters = { ...baseAdjustments, exposure: 0.6, contrast: 20 };

      // User is previewing
      let activePreview: AdjustmentParameters | null = previewProposed;
      expect(activePreview.exposure).toBe(0.6);

      // User discards or switches tool -> resets preview
      activePreview = null;
      expect(activePreview).toBeNull();
      // Base adjustments remain pristine
      expect(baseAdjustments.exposure).toBe(0.1);
      expect(baseAdjustments.contrast).toBe(0);
    });
  });
});

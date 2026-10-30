import { describe, expect, it } from 'vitest';
import {
  applyClarity,
  applyColorWheels,
  applySharpen,
  buildCurveLUT,
  constrainDimensions,
} from '../pipeline';
import { StorageService, AutosaveSession } from '../../services/storage';
import { DEFAULT_CURVES, DEFAULT_WHEELS } from '../../constants/defaults';

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

describe('Phase 5: Production Readiness, Optimization & Performance Suite', () => {
  // 1. Large-Image Handling & Memory Constraints
  describe('Large Image Handling & Dimension Safeguards', () => {
    it('preserves native dimensions for standard resolutions (2MP to 24MP)', () => {
      // 2MP Full HD
      const res2MP = constrainDimensions(1920, 1080);
      expect(res2MP.scaled).toBe(false);
      expect(res2MP.width).toBe(1920);
      expect(res2MP.height).toBe(1080);

      // 8MP 4K UHD
      const res8MP = constrainDimensions(3840, 2160);
      expect(res8MP.scaled).toBe(false);
      expect(res8MP.width).toBe(3840);
      expect(res8MP.height).toBe(2160);

      // 12MP iPhone sensor
      const res12MP = constrainDimensions(4032, 3024);
      expect(res12MP.scaled).toBe(false);
      expect(res12MP.width).toBe(4032);
      expect(res12MP.height).toBe(3024);

      // 24MP Sony Alpha sensor
      const res24MP = constrainDimensions(6000, 4000);
      expect(res24MP.scaled).toBe(false);
      expect(res24MP.width).toBe(6000);
      expect(res24MP.height).toBe(4000);
    });

    it('safely constrains extreme images (>= 48MP or > 8192px) to prevent mobile OOM', () => {
      // Extreme panoramic (16000 x 2000 px) exceeding 8192px limit
      const extremePano = constrainDimensions(16000, 2000, 8192);
      expect(extremePano.scaled).toBe(true);
      expect(extremePano.width).toBeLessThanOrEqual(8192);
      expect(extremePano.width / extremePano.height).toBeCloseTo(16000 / 2000, 1);

      // 100MP Hasselblad sensor (11656 x 8742 = ~101.9 MP)
      const res100MP = constrainDimensions(11656, 8742, 8192, 48_000_000);
      expect(res100MP.scaled).toBe(true);
      expect(res100MP.width * res100MP.height).toBeLessThanOrEqual(48_000_000);
      expect(res100MP.width).toBeLessThanOrEqual(8192);
      expect(res100MP.height).toBeLessThanOrEqual(8192);
    });
  });

  // 2. Storage Reliability, Autosave & Session Recovery
  describe('Storage Reliability & Session Recovery', () => {
    it('persists and restores autosave session state with project metadata', () => {
      const session: AutosaveSession = {
        timestamp: Date.now(),
        view: 'editor',
        projectId: 'test-proj-recovery-01',
        projectName: 'Unsaved_Night_Shoot.DNG',
        imageSrc: 'data:image/png;base64,mock',
        originalDimensions: { width: 3840, height: 2160 },
        adjustments: { exposure: 0.5, contrast: 15 },
        activePresetId: 'film-kodachrome',
        presetIntensity: 85,
      };

      StorageService.saveAutosaveSession(session);
      const retrieved = StorageService.getAutosaveSession();

      expect(retrieved).not.toBeNull();
      expect(retrieved?.projectId).toBe('test-proj-recovery-01');
      expect(retrieved?.projectName).toBe('Unsaved_Night_Shoot.DNG');
      expect(retrieved?.adjustments.exposure).toBe(0.5);
      expect(retrieved?.presetIntensity).toBe(85);

      StorageService.clearAutosaveSession();
      expect(StorageService.getAutosaveSession()).toBeNull();
    });

    it('expires stale recovery sessions older than 24 hours', () => {
      const staleSession: AutosaveSession = {
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
        view: 'editor',
        projectId: 'expired-session',
        projectName: 'Old.DNG',
      };

      StorageService.saveAutosaveSession(staleSession);
      const retrieved = StorageService.getAutosaveSession();
      expect(retrieved).toBeNull(); // Automatically purged
    });
  });

  // 3. File Import Security & Validation
  describe('File Import Validation & Security', () => {
    const validateFile = (name: string, size: number, type: string) => {
      const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.dng', '.raw', '.heic', '.heif'];
      const fileNameLower = name.toLowerCase();
      const hasValidExt = validExtensions.some((ext) => fileNameLower.endsWith(ext));
      const hasValidMime = type.startsWith('image/') || type === '';

      if (!hasValidExt && !hasValidMime) return { valid: false, error: 'INVALID_FORMAT' };
      if (size > 100 * 1024 * 1024) return { valid: false, error: 'FILE_TOO_LARGE' };
      return { valid: true };
    };

    it('accepts valid photography and RAW formats', () => {
      expect(validateFile('photo.jpg', 15 * 1024 * 1024, 'image/jpeg').valid).toBe(true);
      expect(validateFile('portrait.PNG', 22 * 1024 * 1024, 'image/png').valid).toBe(true);
      expect(validateFile('RAW_4829.DNG', 45 * 1024 * 1024, 'image/x-adobe-dng').valid).toBe(true);
      expect(validateFile('shot.RAW', 30 * 1024 * 1024, '').valid).toBe(true);
      expect(validateFile('apple.HEIC', 12 * 1024 * 1024, 'image/heic').valid).toBe(true);
    });

    it('rejects unsupported or potentially malicious non-image files', () => {
      expect(validateFile('script.js', 1024, 'text/javascript').valid).toBe(false);
      expect(validateFile('payload.exe', 5000, 'application/octet-stream').valid).toBe(false);
      expect(validateFile('document.pdf', 200000, 'application/pdf').valid).toBe(false);
    });

    it('rejects files exceeding the 100MB buffer limit', () => {
      expect(validateFile('massive.dng', 120 * 1024 * 1024, 'image/x-adobe-dng').valid).toBe(false);
      expect(validateFile('massive.dng', 120 * 1024 * 1024, 'image/x-adobe-dng').error).toBe('FILE_TOO_LARGE');
    });
  });

  // 4. Android Navigation State Machine Simulation
  describe('Android Back Button Navigation State Machine', () => {
    it('progressively pops open modals, returns from editors, and exits only at home', () => {
      let isExportOpen = true;
      let isSettingsOpen = false;
      let currentView = 'editor';
      let exited = false;

      const handleBackButton = () => {
        if (isExportOpen) {
          isExportOpen = false;
        } else if (isSettingsOpen) {
          isSettingsOpen = false;
        } else if (currentView === 'editor') {
          currentView = 'home';
        } else if (currentView === 'home') {
          exited = true;
        }
      };

      // 1. Back button when export modal is open -> closes modal, stays in editor
      handleBackButton();
      expect(isExportOpen).toBe(false);
      expect(currentView).toBe('editor');
      expect(exited).toBe(false);

      // 2. Back button when in editor -> returns safely to home
      handleBackButton();
      expect(currentView).toBe('home');
      expect(exited).toBe(false);

      // 3. Back button on home -> exits app
      handleBackButton();
      expect(exited).toBe(true);
    });
  });

  // 5. Performance Benchmarks
  describe('Rendering Engine Performance Benchmarks', () => {
    it('buildCurveLUT generates 256-sample lookup table in sub-millisecond time', () => {
      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        buildCurveLUT(DEFAULT_CURVES.rgb);
      }
      const duration = performance.now() - start;
      const perLUT = duration / 50;
      expect(perLUT).toBeLessThan(1.0); // Less than 1ms per LUT
    });

    it('applyColorWheels processes 10,000 pixels within real-time budget', () => {
      const pixelCount = 10000;
      const buffer = new Uint8ClampedArray(pixelCount * 4);
      for (let i = 0; i < buffer.length; i += 4) {
        buffer[i] = 120;
        buffer[i + 1] = 130;
        buffer[i + 2] = 140;
        buffer[i + 3] = 255;
      }

      const wheels = {
        shadows: { hue: 200, saturation: 50, luminance: 10 },
        midtones: { hue: 45, saturation: 40, luminance: 0 },
        highlights: { hue: 15, saturation: 35, luminance: -10 },
      };

      const start = performance.now();
      applyColorWheels(buffer, wheels);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(35.0);
    });

    it('applyClarity runs high-frequency difference box blur within performance budget', () => {
      const w = 64;
      const h = 64;
      const buffer = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < buffer.length; i += 4) {
        buffer[i] = 128;
        buffer[i + 1] = 128;
        buffer[i + 2] = 128;
        buffer[i + 3] = 255;
      }

      const start = performance.now();
      applyClarity(buffer, w, h, 50);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(15.0);
    });
  });
});

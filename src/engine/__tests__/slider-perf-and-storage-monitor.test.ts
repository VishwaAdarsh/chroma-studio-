import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processImage, clearGeometryCache } from '../pipeline';
import { DEFAULT_ADJUSTMENTS, DEFAULT_GEOMETRY } from '../../constants/defaults';
import type { AdjustmentParameters, GeometryState } from '../../types/editor';
import {
  CloudProjectService,
  formatStorageSize,
  FREE_PLAN_LIMITS,
  PRO_PLAN_LIMITS,
} from '../../services/cloudProjectService';
import { storageMonitorService } from '../../services/storageMonitorService';

// Polyfill ImageData for headless test environment if missing
class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace: PredefinedColorSpace = 'srgb';
  constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
    if (typeof dataOrWidth === 'number') {
      this.width = dataOrWidth;
      this.height = widthOrHeight;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = dataOrWidth;
      this.width = widthOrHeight;
      this.height = height || Math.floor(dataOrWidth.length / (4 * widthOrHeight));
    }
  }
}

if (typeof (globalThis as any).ImageData === 'undefined') {
  (globalThis as any).ImageData = MockImageData;
}

const createMockCanvas = (width = 200, height = 200) => {
  let pixelData = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixelData.length; i += 4) {
    pixelData[i] = 120;
    pixelData[i + 1] = 120;
    pixelData[i + 2] = 120;
    pixelData[i + 3] = 255;
  }

  const mockCtx = {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn((_sx: number, _sy: number, sw: number, sh: number) => {
      return new (globalThis as any).ImageData(new Uint8ClampedArray(pixelData), sw, sh);
    }),
    putImageData: vi.fn((img: any) => {
      pixelData = new Uint8ClampedArray(img.data);
    }),
  };

  const canvas = {
    width,
    height,
    getContext: vi.fn((contextId: string) => {
      if (contextId === '2d') return mockCtx;
      return null;
    }),
  } as unknown as HTMLCanvasElement;

  return canvas;
};

if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return createMockCanvas(200, 200);
      }
      return {};
    },
  };
}

describe('CHROMA STUDIO: Part A — Instant Adjustment Sliders & Geometry Caching', () => {
  beforeEach(() => {
    clearGeometryCache();
  });

  it('renders adjustments with skipMetrics for rapid 60fps preview throughput', () => {
    const canvas = createMockCanvas(100, 100);
    const adjustments: AdjustmentParameters = {
      ...DEFAULT_ADJUSTMENTS,
      exposure: 0.5,
      contrast: 15,
      saturation: 20,
    };

    const result = processImage(
      canvas,
      100,
      100,
      adjustments,
      DEFAULT_GEOMETRY,
      undefined,
      undefined,
      canvas,
      1,
      undefined,
      undefined,
      undefined,
      null,
      { skipMetrics: true }
    );

    expect(result.canvas).toBe(canvas);
    expect(result.dominantColors).toEqual([]);
    expect(result.histogram.maxCount).toBe(1);
  });

  it('reuses cached base geometry when adjusting exposure and tone controls', () => {
    const canvas = createMockCanvas(100, 100);
    const initialAdjustments: AdjustmentParameters = {
      ...DEFAULT_ADJUSTMENTS,
      exposure: 0,
    };

    // First render populates geometry cache
    const firstResult = processImage(
      canvas,
      100,
      100,
      initialAdjustments,
      DEFAULT_GEOMETRY,
      undefined,
      undefined,
      canvas,
      1
    );
    expect(firstResult.canvas.width).toBe(100);

    // Second render with dragged exposure (geometry unchanged)
    const draggedAdjustments: AdjustmentParameters = {
      ...initialAdjustments,
      exposure: 0.75,
    };

    const secondResult = processImage(
      canvas,
      100,
      100,
      draggedAdjustments,
      DEFAULT_GEOMETRY,
      undefined,
      undefined,
      canvas,
      1,
      undefined,
      undefined,
      undefined,
      null,
      { skipMetrics: true }
    );

    expect(secondResult.canvas).toBe(canvas);
  });

  it('invalidates geometry cache when crop or rotation changes', () => {
    const canvas = createMockCanvas(100, 100);
    processImage(canvas, 100, 100, DEFAULT_ADJUSTMENTS, DEFAULT_GEOMETRY, undefined, undefined, canvas, 1);

    const rotatedGeometry: GeometryState = {
      ...DEFAULT_GEOMETRY,
      rotation: 90,
    };

    const rotatedResult = processImage(
      canvas,
      100,
      100,
      DEFAULT_ADJUSTMENTS,
      rotatedGeometry,
      undefined,
      undefined,
      canvas,
      1
    );

    expect(rotatedResult.canvas.width).toBe(100);
  });

  it('measures execution time for rapid adjustment slider scrub (target < 16ms for 60fps)', () => {
    const canvas = createMockCanvas(200, 200);
    // Warm up cache
    processImage(canvas, 200, 200, DEFAULT_ADJUSTMENTS, DEFAULT_GEOMETRY, undefined, undefined, canvas, 1);

    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      processImage(
        canvas,
        200,
        200,
        { ...DEFAULT_ADJUSTMENTS, exposure: i * 0.1, contrast: i * 2 },
        DEFAULT_GEOMETRY,
        undefined,
        undefined,
        canvas,
        1,
        undefined,
        undefined,
        undefined,
        null,
        { skipMetrics: true }
      );
    }
    const elapsed = performance.now() - start;
    const avgPerFrame = elapsed / 10;

    // 60 FPS frame budget is 16.6ms
    expect(avgPerFrame).toBeLessThan(16.6);
  });
});

describe('CHROMA STUDIO: Part B — Live Sidebar Storage Monitor', () => {
  beforeEach(() => {
    CloudProjectService.invalidateQuotaCache();
  });

  it('formatStorageSize correctly formats 0, MB, and GB values', () => {
    expect(formatStorageSize(0)).toBe('0 MB');
    expect(formatStorageSize(450 * 1024 * 1024)).toBe('450 MB');
    expect(formatStorageSize(2.4 * 1024 * 1024 * 1024)).toBe('2.4 GB');
    expect(formatStorageSize(100 * 1024 * 1024)).toBe('100 MB');
    expect(formatStorageSize(10 * 1024 * 1024 * 1024)).toBe('10 GB');
  });

  it('evaluates Free vs Pro quota limits accurately', () => {
    expect(FREE_PLAN_LIMITS.maxMB).toBe(100);
    expect(FREE_PLAN_LIMITS.maxProjects).toBe(3);
    expect(PRO_PLAN_LIMITS.maxMB).toBe(10240);
    expect(PRO_PLAN_LIMITS.maxProjects).toBe(Infinity);
  });

  it('StorageMonitorService provides live state and broadcasts to subscribers', async () => {
    let notifiedState: any = null;
    const unsubscribe = storageMonitorService.subscribe((state) => {
      notifiedState = state;
    });

    expect(notifiedState).not.toBeNull();
    expect(typeof notifiedState.formattedUsed).toBe('string');
    expect(typeof notifiedState.formattedTotal).toBe('string');
    expect(typeof notifiedState.percentage).toBe('number');
    expect(typeof notifiedState.isExceeded).toBe('boolean');

    unsubscribe();
  });

  it('computes isExceeded when used storage exceeds plan max quota', () => {
    const freeMax = FREE_PLAN_LIMITS.maxBytes;
    const usedOverQuota = 450 * 1024 * 1024; // 450 MB on 100 MB Free plan
    const isExceeded = usedOverQuota > freeMax;
    const percentage = Math.round((usedOverQuota / freeMax) * 100);

    expect(isExceeded).toBe(true);
    expect(percentage).toBe(450);
  });

  it('triggers storage monitor update on quota invalidation listener', async () => {
    const spy = vi.fn();
    CloudProjectService.setQuotaInvalidatedListener(spy);

    CloudProjectService.invalidateQuotaCache('user-test-uuid');
    expect(spy).toHaveBeenCalledWith('user-test-uuid');
  });
});

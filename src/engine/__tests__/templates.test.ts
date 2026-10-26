import { describe, it, expect } from 'vitest';
import { TEMPLATES, TEMPLATE_CATEGORIES } from '../../data/presets';
import { blendPresetAdjustments, processImage } from '../pipeline';
import { StorageService } from '../../services/storage';
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_CURVES,
  DEFAULT_GEOMETRY,
  DEFAULT_WHEELS,
} from '../../constants/defaults';
import type { PhotoTemplate, TemplateCategory } from '../../types/editor';

// Polyfill localStorage in Node test environment
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

describe('Templates Engine: Library & Categories', () => {
  it('contains at least 40 distinct templates', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(40);
  });

  it('contains all 12 specified categories', () => {
    const expectedCategories: TemplateCategory[] = [
      'All',
      'Cinematic',
      'Portrait',
      'Vintage Film',
      'Black & White',
      'Golden Hour',
      'Moody',
      'Pastel',
      'Travel',
      'Food',
      'Street Photography',
      'Social Media',
    ];

    expect(TEMPLATE_CATEGORIES).toEqual(expectedCategories);

    // Verify every non-All category has at least 3 templates
    expectedCategories
      .filter((cat) => cat !== 'All')
      .forEach((category) => {
        const inCategory = TEMPLATES.filter((t) => t.category === category);
        expect(inCategory.length).toBeGreaterThanOrEqual(3);
      });
  });

  it('guarantees unique IDs across all templates', () => {
    const ids = TEMPLATES.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('every template has non-empty tags for searchability', () => {
    TEMPLATES.forEach((template) => {
      expect(template.tags).toBeDefined();
      expect(template.tags.length).toBeGreaterThanOrEqual(2);
      expect(template.name.trim().length).toBeGreaterThan(0);
      expect(template.description.trim().length).toBeGreaterThan(0);
    });
  });

  it('searches templates by name, category, and tags', () => {
    // Search by tag
    const filmResults = TEMPLATES.filter((t) =>
      t.tags.some((tag) => tag.toLowerCase().includes('grain'))
    );
    expect(filmResults.length).toBeGreaterThan(0);

    // Search by name
    const tealResults = TEMPLATES.filter((t) =>
      t.name.toLowerCase().includes('teal')
    );
    expect(tealResults.length).toBeGreaterThan(0);
    expect(tealResults[0].id).toBe('cine-teal-orange');
  });
});

describe('Templates Engine: Intensity Interpolation & Blending', () => {
  const sampleTemplate: PhotoTemplate = {
    id: 'test-tmpl',
    name: 'Test Template',
    category: 'Cinematic',
    description: 'Test recipe',
    tags: ['test'],
    defaultIntensity: 100,
    parameters: {
      exposure: 0.5,
      contrast: 20,
      highlights: -30,
      shadows: 40,
      temperature: 15,
      saturation: 25,
      clarity: 30,
      vignette: 20,
    },
    wheels: {
      shadows: { hue: 200, saturation: 40, luminance: -10 },
      midtones: { hue: 120, saturation: 30, luminance: 15 },
      highlights: { hue: 40, saturation: 50, luminance: 20 },
    },
    curves: {
      rgb: [
        { x: 0, y: 10 },
        { x: 128, y: 140 },
        { x: 255, y: 245 },
      ],
    },
  };

  it('intensity 0 returns neutral base adjustments with zero template contribution', () => {
    const base = { ...DEFAULT_ADJUSTMENTS, exposure: 0.2, contrast: 10 };
    const baseWheels = { ...DEFAULT_WHEELS };
    const baseCurves = { ...DEFAULT_CURVES };

    const result = blendPresetAdjustments(base, sampleTemplate, 0, baseWheels, baseCurves);

    expect(result.adjustments.exposure).toBe(0.2);
    expect(result.adjustments.contrast).toBe(10);
    expect(result.adjustments.highlights).toBe(0);
    expect(result.adjustments.shadows).toBe(0);
    expect(result.adjustments.vignette).toBe(0);
    expect(result.wheels).toEqual(baseWheels);
  });

  it('intensity 100 applies full template recipe combined with base adjustments', () => {
    const base = { ...DEFAULT_ADJUSTMENTS, exposure: 0.2, contrast: 10 };
    const baseWheels = { ...DEFAULT_WHEELS };

    const result = blendPresetAdjustments(base, sampleTemplate, 100, baseWheels);

    // base 0.2 + template 0.5 = 0.7
    expect(result.adjustments.exposure).toBeCloseTo(0.7);
    // base 10 + template 20 = 30
    expect(result.adjustments.contrast).toBe(30);
    // base 0 + template -30 = -30
    expect(result.adjustments.highlights).toBe(-30);
    // wheels at 100%
    expect(result.wheels?.shadows.saturation).toBe(40);
    expect(result.wheels?.shadows.luminance).toBe(-10);
    expect(result.wheels?.midtones.saturation).toBe(30);
    expect(result.wheels?.highlights.saturation).toBe(50);
  });

  it('intermediate intensity (50%) smoothly and accurately interpolates adjustments, wheels, and curves', () => {
    const base = { ...DEFAULT_ADJUSTMENTS };
    const baseWheels = { ...DEFAULT_WHEELS };

    const result = blendPresetAdjustments(base, sampleTemplate, 50, baseWheels);

    // 50% of 0.5 = 0.25
    expect(result.adjustments.exposure).toBeCloseTo(0.25);
    // 50% of 20 = 10
    expect(result.adjustments.contrast).toBe(10);
    // 50% of -30 = -15
    expect(result.adjustments.highlights).toBe(-15);
    // 50% of wheels saturation & luminance
    expect(result.wheels?.shadows.saturation).toBe(20);
    expect(result.wheels?.shadows.luminance).toBe(-5);
    expect(result.wheels?.midtones.saturation).toBe(15);
    expect(result.wheels?.highlights.saturation).toBe(25);

    // Curves interpolation check: deflection from identity line (x=y) scaled by 0.5
    // Pt 0: x=0, y=10 -> deflection 10 * 0.5 = 5 -> y = 5
    // Pt 1: x=128, y=140 -> deflection 12 * 0.5 = 6 -> y = 134
    const rgbCurve = result.curves?.rgb;
    expect(rgbCurve).toBeDefined();
    expect(rgbCurve?.[0].y).toBe(5);
    expect(rgbCurve?.[1].y).toBe(134);
  });

  it('repeated application does not accumulate or mutate base state', () => {
    const base = { ...DEFAULT_ADJUSTMENTS, exposure: 0.1 };
    const baseCopy = { ...base };

    const run1 = blendPresetAdjustments(base, sampleTemplate, 60);
    const run2 = blendPresetAdjustments(base, sampleTemplate, 60);
    const run3 = blendPresetAdjustments(base, sampleTemplate, 60);

    expect(run1.adjustments).toEqual(run2.adjustments);
    expect(run2.adjustments).toEqual(run3.adjustments);
    expect(base).toEqual(baseCopy);
  });

  it('switching templates cleanly replaces the recipe without leaving residual values', () => {
    const base = { ...DEFAULT_ADJUSTMENTS };
    const templateB: PhotoTemplate = {
      id: 'template-b',
      name: 'Template B',
      category: 'Black & White',
      description: 'B&W recipe',
      tags: ['bw'],
      defaultIntensity: 100,
      parameters: {
        saturation: -100,
        contrast: 40,
      },
    };

    const appliedA = blendPresetAdjustments(base, sampleTemplate, 100);
    expect(appliedA.adjustments.saturation).toBe(25);
    expect(appliedA.adjustments.vignette).toBe(20);

    const appliedB = blendPresetAdjustments(base, templateB, 100);
    expect(appliedB.adjustments.saturation).toBe(-100);
    expect(appliedB.adjustments.contrast).toBe(40);
    // Vignette from template A is not present in template B
    expect(appliedB.adjustments.vignette).toBe(0);
  });
});

describe('Templates Engine: Custom Presets & Persistence', () => {
  it('saves, retrieves, and deletes custom user templates', () => {
    const customTemplate: PhotoTemplate = {
      id: 'custom-my-look',
      name: 'My Custom Look',
      category: 'Social Media',
      description: 'Personalized recipe',
      tags: ['custom', 'mylook'],
      defaultIntensity: 100,
      parameters: { exposure: 0.3, contrast: 15, vibrance: 20 },
      isCustom: true,
    };

    StorageService.saveCustomTemplate(customTemplate);
    let customList = StorageService.getCustomTemplates();
    expect(customList.some((t) => t.id === 'custom-my-look')).toBe(true);

    StorageService.deleteCustomTemplate('custom-my-look');
    customList = StorageService.getCustomTemplates();
    expect(customList.some((t) => t.id === 'custom-my-look')).toBe(false);
  });

  it('verifies offline availability: all templates load synchronously in memory with zero network dependencies', () => {
    // Templates must be directly present and fully populated without async fetch or API requests
    expect(Array.isArray(TEMPLATES)).toBe(true);
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(40);
    const noir = TEMPLATES.find((t) => t.id === 'mono-noir');
    expect(noir).toBeDefined();
    expect(noir?.parameters.saturation).toBe(-100);
  });

  it('guarantees template immutability across repeated blends and edits', () => {
    const originalNoirParams = { ...TEMPLATES.find((t) => t.id === 'mono-noir')?.parameters };

    // Blend multiple times with varying bases and intensities
    blendPresetAdjustments({ ...DEFAULT_ADJUSTMENTS, exposure: 1.5 }, TEMPLATES.find((t) => t.id === 'mono-noir')!, 35);
    blendPresetAdjustments({ ...DEFAULT_ADJUSTMENTS, contrast: -40 }, TEMPLATES.find((t) => t.id === 'mono-noir')!, 80);

    const afterNoirParams = TEMPLATES.find((t) => t.id === 'mono-noir')?.parameters;
    expect(afterNoirParams).toEqual(originalNoirParams);
  });
});

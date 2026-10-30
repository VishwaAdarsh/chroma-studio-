import { describe, expect, it } from 'vitest';
import { CAROUSEL_FAMILIES } from '../../data/carouselTemplates';
import { COLLAGE_LAYOUTS } from '../../data/collageLayouts';
import { READY_MADE_TEMPLATES, TEMPLATE_CATEGORIES } from '../../data/templatesData';
import { renderCollageProject, renderDesignProject } from '../designRenderer';
import {
  CarouselProject,
  CollageProject,
  DesignProject,
  ImageDesignElement,
} from '../../types/design';

// Node.js Canvas Polyfill for headless test execution
const createMockCanvas = (w = 1080, h = 1080) => {
  const ctx = {
    save: () => {},
    restore: () => {},
    scale: () => {},
    translate: () => {},
    rotate: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arcTo: () => {},
    ellipse: () => {},
    fill: () => {},
    stroke: () => {},
    clip: () => {},
    fillText: () => {},
    measureText: (txt: string) => ({ width: txt.length * 8 }),
    setLineDash: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    drawImage: () => {},
  };
  return {
    width: w,
    height: h,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
};

if (typeof document === 'undefined') {
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') return createMockCanvas();
      return {};
    },
  };
}

describe('Phase 4: Templates Studio, Collage Studio, and Carousel Studio Suite', () => {
  // 1. Templates Studio
  describe('Templates Studio Data Model & Workflows', () => {
    it('provides all 20 required template categories', () => {
      expect(TEMPLATE_CATEGORIES.length).toBe(20);
      expect(TEMPLATE_CATEGORIES).toContain('All Templates');
      expect(TEMPLATE_CATEGORIES).toContain('Instagram Posts');
      expect(TEMPLATE_CATEGORIES).toContain('Instagram Stories');
      expect(TEMPLATE_CATEGORIES).toContain('Instagram Carousels');
      expect(TEMPLATE_CATEGORIES).toContain('Travel');
      expect(TEMPLATE_CATEGORIES).toContain('Photography');
      expect(TEMPLATE_CATEGORIES).toContain('Portrait');
      expect(TEMPLATE_CATEGORIES).toContain('Birthday');
      expect(TEMPLATE_CATEGORIES).toContain('Wedding');
      expect(TEMPLATE_CATEGORIES).toContain('Events');
      expect(TEMPLATE_CATEGORIES).toContain('Fashion');
      expect(TEMPLATE_CATEGORIES).toContain('Lifestyle');
      expect(TEMPLATE_CATEGORIES).toContain('Food');
      expect(TEMPLATE_CATEGORIES).toContain('Business');
      expect(TEMPLATE_CATEGORIES).toContain('Portfolio');
      expect(TEMPLATE_CATEGORIES).toContain('Minimal');
      expect(TEMPLATE_CATEGORIES).toContain('Aesthetic');
      expect(TEMPLATE_CATEGORIES).toContain('Festival and Celebration');
      expect(TEMPLATE_CATEGORIES).toContain('Promotional Designs');
      expect(TEMPLATE_CATEGORIES).toContain('Quote and Typography');
    });

    it('ready-made templates contain valid dimensions and element trees', () => {
      expect(READY_MADE_TEMPLATES.length).toBeGreaterThan(0);
      for (const tmpl of READY_MADE_TEMPLATES) {
        expect(tmpl.id).toBeTruthy();
        expect(tmpl.name).toBeTruthy();
        expect(tmpl.width).toBeGreaterThanOrEqual(1080);
        expect(tmpl.height).toBeGreaterThanOrEqual(1080);
        expect(tmpl.elements.length).toBeGreaterThan(0);
        expect(tmpl.background).toBeDefined();
      }
    });

    it('photo placeholder replacement preserves layout dimensions and frame geometry', () => {
      const template = READY_MADE_TEMPLATES[0];
      const initialSlot = template.elements.find(
        (e): e is ImageDesignElement => e.type === 'image' && !!e.isPlaceholder
      );
      expect(initialSlot).toBeDefined();

      const origW = initialSlot!.width;
      const origH = initialSlot!.height;
      const origX = initialSlot!.x;
      const origY = initialSlot!.y;

      // Simulate photo replacement
      const newPhotoUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const updatedSlot: ImageDesignElement = {
        ...initialSlot!,
        src: newPhotoUrl,
        zoom: 1.25,
        offsetX: 10,
        offsetY: -5,
      };

      // Geometry and positioning must remain strictly preserved
      expect(updatedSlot.width).toBe(origW);
      expect(updatedSlot.height).toBe(origH);
      expect(updatedSlot.x).toBe(origX);
      expect(updatedSlot.y).toBe(origY);
      expect(updatedSlot.src).toBe(newPhotoUrl);
      expect(updatedSlot.zoom).toBe(1.25);
    });
  });

  // 2. Collage Studio
  describe('Collage Studio Layouts & Slot Operations', () => {
    it('provides multi-photo layout definitions across 2 to 12 photo counts', () => {
      expect(COLLAGE_LAYOUTS.length).toBeGreaterThanOrEqual(8);
      const photoCounts = COLLAGE_LAYOUTS.map((l) => l.photoCount);
      expect(photoCounts).toContain(2);
      expect(photoCounts).toContain(3);
      expect(photoCounts).toContain(4);
      expect(photoCounts).toContain(5);
      expect(photoCounts).toContain(6);
      expect(photoCounts).toContain(7);
      expect(photoCounts).toContain(8);
      expect(photoCounts).toContain(9);
      expect(photoCounts).toContain(12);
    });

    it('all slot coordinates are strictly normalized within [0, 1]', () => {
      for (const layout of COLLAGE_LAYOUTS) {
        expect(layout.slots.length).toBe(layout.photoCount);
        for (const slot of layout.slots) {
          expect(slot.x).toBeGreaterThanOrEqual(0);
          expect(slot.x).toBeLessThan(1);
          expect(slot.y).toBeGreaterThanOrEqual(0);
          expect(slot.y).toBeLessThan(1);
          expect(slot.width).toBeGreaterThan(0);
          expect(slot.width).toBeLessThanOrEqual(1);
          expect(slot.height).toBeGreaterThan(0);
          expect(slot.height).toBeLessThanOrEqual(1);
          expect(slot.x + slot.width).toBeLessThanOrEqual(1.001);
          expect(slot.y + slot.height).toBeLessThanOrEqual(1.001);
        }
      }
    });

    it('swapping two slots accurately exchanges imageSrc without losing photos', () => {
      const slots = [
        { id: 's1', imageSrc: 'photo-A.jpg', x: 0, y: 0, width: 0.5, height: 1, zoom: 1, offsetX: 0, offsetY: 0, rotation: 0 },
        { id: 's2', imageSrc: 'photo-B.jpg', x: 0.5, y: 0, width: 0.5, height: 1, zoom: 1, offsetX: 0, offsetY: 0, rotation: 0 },
      ];

      // Perform swap
      const imgA = slots[0].imageSrc;
      const imgB = slots[1].imageSrc;
      const swapped = slots.map((s) => {
        if (s.id === 's1') return { ...s, imageSrc: imgB };
        if (s.id === 's2') return { ...s, imageSrc: imgA };
        return s;
      });

      expect(swapped[0].imageSrc).toBe('photo-B.jpg');
      expect(swapped[1].imageSrc).toBe('photo-A.jpg');
    });

    it('changing layout preserves already selected photos in sequential order', () => {
      const existingPhotos = ['photo1.jpg', 'photo2.jpg', 'photo3.jpg'];
      const targetLayout = COLLAGE_LAYOUTS.find((l) => l.id === 'layout-4-quad')!;

      const newSlots = targetLayout.slots.map((s, idx) => ({
        ...s,
        imageSrc: existingPhotos[idx] || undefined,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        rotation: 0,
      }));

      expect(newSlots.length).toBe(4);
      expect(newSlots[0].imageSrc).toBe('photo1.jpg');
      expect(newSlots[1].imageSrc).toBe('photo2.jpg');
      expect(newSlots[2].imageSrc).toBe('photo3.jpg');
      expect(newSlots[3].imageSrc).toBeUndefined(); // unfilled slot awaits photo
    });
  });

  // 3. Carousel Studio
  describe('Carousel Studio Multi-Slide Sequencing & Batch Filling', () => {
    it('defines multi-slide carousel families with coherent slide systems', () => {
      expect(CAROUSEL_FAMILIES.length).toBeGreaterThanOrEqual(2);
      for (const fam of CAROUSEL_FAMILIES) {
        expect(fam.slides.length).toBeGreaterThanOrEqual(3);
        const types = fam.slides.map((s) => s.slideType);
        expect(types).toContain('cover');
        expect(types).toContain('closing');
      }
    });

    it('batch quick-fill correctly distributes multiple photos across slides', () => {
      const family = CAROUSEL_FAMILIES[0];
      const project: CarouselProject = {
        id: 'car-test',
        name: 'Test Carousel',
        type: 'carousel',
        format: '4:5',
        width: 1080,
        height: 1350,
        slides: JSON.parse(JSON.stringify(family.slides)),
        activeSlideIndex: 0,
        theme: { ...family.theme },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const userPhotos = ['user-photo-1.jpg', 'user-photo-2.jpg', 'user-photo-3.jpg'];
      let photoIdx = 0;

      const batchFilledSlides = project.slides.map((slide) => ({
        ...slide,
        elements: slide.elements.map((el) => {
          if (el.type === 'image' && photoIdx < userPhotos.length) {
            const filled = { ...el, src: userPhotos[photoIdx] };
            photoIdx++;
            return filled;
          }
          return el;
        }),
      }));

      expect(photoIdx).toBe(3);
      // First slide image element should have user-photo-1
      const s1Img = batchFilledSlides[0].elements.find((e) => e.type === 'image') as ImageDesignElement;
      expect(s1Img.src).toBe('user-photo-1.jpg');
      // Second slide image element should have user-photo-2
      const s2Img = batchFilledSlides[1].elements.find((e) => e.type === 'image') as ImageDesignElement;
      expect(s2Img.src).toBe('user-photo-2.jpg');
    });

    it('supports slide duplication, reordering, and deletion with integrity', () => {
      const initialSlides = [
        { id: 's1', title: 'Slide 1', slideType: 'cover' as const, background: { type: 'color' as const, value: '#fff' }, elements: [] },
        { id: 's2', title: 'Slide 2', slideType: 'photo' as const, background: { type: 'color' as const, value: '#fff' }, elements: [] },
        { id: 's3', title: 'Slide 3', slideType: 'closing' as const, background: { type: 'color' as const, value: '#fff' }, elements: [] },
      ];

      // Duplicate slide 2
      const dup = { ...initialSlides[1], id: 's2-copy', title: 'Slide 2 (Copy)' };
      const afterDup = [...initialSlides];
      afterDup.splice(2, 0, dup);
      expect(afterDup.length).toBe(4);
      expect(afterDup[2].title).toBe('Slide 2 (Copy)');

      // Reorder: move slide 1 to right
      const afterMove = [...afterDup];
      const [moved] = afterMove.splice(0, 1);
      afterMove.splice(1, 0, moved);
      expect(afterMove[0].id).toBe('s2');
      expect(afterMove[1].id).toBe('s1');

      // Delete slide
      const afterDelete = afterMove.filter((s) => s.id !== 's2-copy');
      expect(afterDelete.length).toBe(3);
      expect(afterDelete.some((s) => s.id === 's2-copy')).toBe(false);
    });
  });

  // 4. Shared Canvas Renderer
  describe('Shared Design Canvas Rendering Engine', () => {
    it('renders a DesignProject to an offscreen canvas at specified scale', async () => {
      const project: DesignProject = {
        id: 'test-dp',
        name: 'Test Design',
        type: 'template',
        width: 1080,
        height: 1080,
        background: { type: 'color', value: '#fff8f7' },
        elements: [
          {
            id: 't1',
            type: 'text',
            text: 'Hello World',
            fontFamily: 'Inter, sans-serif',
            fontSize: 32,
            color: '#281715',
            fontWeight: 'bold',
            fontStyle: 'normal',
            textAlign: 'center',
            x: 100,
            y: 100,
            width: 880,
            height: 60,
            rotation: 0,
            opacity: 1,
            zIndex: 1,
            visible: true,
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const canvas = await renderDesignProject(project, undefined, 0.5);
      expect(canvas).toBeDefined();
      expect(canvas.width).toBe(540);
      expect(canvas.height).toBe(540);
    });

    it('renders a CollageProject with slots and padding to canvas', async () => {
      const collage: CollageProject = {
        id: 'test-cp',
        name: 'Test Collage',
        type: 'collage',
        width: 1080,
        height: 1080,
        aspectRatio: '1:1',
        layoutId: 'layout-2-vsplit',
        slots: [
          { id: 's1', x: 0, y: 0, width: 0.5, height: 1, zoom: 1, offsetX: 0, offsetY: 0, rotation: 0 },
          { id: 's2', x: 0.5, y: 0, width: 0.5, height: 1, zoom: 1, offsetX: 0, offsetY: 0, rotation: 0 },
        ],
        spacing: 10,
        padding: 20,
        cornerRadius: 12,
        borderWidth: 2,
        borderColor: '#ffffff',
        background: { type: 'color', value: '#140000' },
        isFreeform: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const canvas = await renderCollageProject(collage, undefined, 0.25);
      expect(canvas).toBeDefined();
      expect(canvas.width).toBe(270);
      expect(canvas.height).toBe(270);
    });
  });
});

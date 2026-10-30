import { CollageLayoutDefinition } from '../types/design';

export const COLLAGE_LAYOUTS: CollageLayoutDefinition[] = [
  // --- 2 PHOTOS ---
  {
    id: 'layout-2-vsplit',
    name: 'Vertical Split',
    photoCount: 2,
    style: 'split',
    aspectRatio: '1:1',
    slots: [
      { id: 's1', x: 0, y: 0, width: 0.5, height: 1 },
      { id: 's2', x: 0.5, y: 0, width: 0.5, height: 1 },
    ],
  },
  {
    id: 'layout-2-hsplit',
    name: 'Horizontal Split',
    photoCount: 2,
    style: 'split',
    aspectRatio: '4:5',
    slots: [
      { id: 's1', x: 0, y: 0, width: 1, height: 0.5 },
      { id: 's2', x: 0, y: 0.5, width: 1, height: 0.5 },
    ],
  },
  {
    id: 'layout-2-polaroid',
    name: 'Polaroid Duo',
    photoCount: 2,
    style: 'polaroid',
    aspectRatio: '1:1',
    slots: [
      { id: 's1', x: 0.05, y: 0.1, width: 0.42, height: 0.8 },
      { id: 's2', x: 0.53, y: 0.1, width: 0.42, height: 0.8 },
    ],
  },

  // --- 3 PHOTOS ---
  {
    id: 'layout-3-hero-top',
    name: 'Hero Top + 2 Bottom',
    photoCount: 3,
    style: 'magazine',
    aspectRatio: '4:5',
    slots: [
      { id: 's1', x: 0, y: 0, width: 1, height: 0.6 },
      { id: 's2', x: 0, y: 0.6, width: 0.5, height: 0.4 },
      { id: 's3', x: 0.5, y: 0.6, width: 0.5, height: 0.4 },
    ],
  },
  {
    id: 'layout-3-columns',
    name: 'Triptych 3 Columns',
    photoCount: 3,
    style: 'grid',
    aspectRatio: '1:1',
    slots: [
      { id: 's1', x: 0, y: 0, width: 0.333, height: 1 },
      { id: 's2', x: 0.333, y: 0, width: 0.333, height: 1 },
      { id: 's3', x: 0.666, y: 0, width: 0.334, height: 1 },
    ],
  },
  {
    id: 'layout-3-hero-left',
    name: 'Editorial Left Hero',
    photoCount: 3,
    style: 'editorial',
    aspectRatio: '16:9',
    slots: [
      { id: 's1', x: 0, y: 0, width: 0.6, height: 1 },
      { id: 's2', x: 0.6, y: 0, width: 0.4, height: 0.5 },
      { id: 's3', x: 0.6, y: 0.5, width: 0.4, height: 0.5 },
    ],
  },

  // --- 4 PHOTOS ---
  {
    id: 'layout-4-quad',
    name: 'Classic 2×2 Grid',
    photoCount: 4,
    style: 'grid',
    aspectRatio: '1:1',
    slots: [
      { id: 's1', x: 0, y: 0, width: 0.5, height: 0.5 },
      { id: 's2', x: 0.5, y: 0, width: 0.5, height: 0.5 },
      { id: 's3', x: 0, y: 0.5, width: 0.5, height: 0.5 },
      { id: 's4', x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    ],
  },
  {
    id: 'layout-4-hero-left',
    name: 'Magazine Hero + 3 Stack',
    photoCount: 4,
    style: 'magazine',
    aspectRatio: '4:5',
    slots: [
      { id: 's1', x: 0, y: 0, width: 0.65, height: 1 },
      { id: 's2', x: 0.65, y: 0, width: 0.35, height: 0.333 },
      { id: 's3', x: 0.65, y: 0.333, width: 0.35, height: 0.333 },
      { id: 's4', x: 0.65, y: 0.666, width: 0.35, height: 0.334 },
    ],
  },

  // --- 5 PHOTOS ---
  {
    id: 'layout-5-mosaic',
    name: 'Mosaic 5-Photo',
    photoCount: 5,
    style: 'pinterest',
    aspectRatio: '4:5',
    slots: [
      { id: 's1', x: 0, y: 0, width: 0.5, height: 0.4 },
      { id: 's2', x: 0.5, y: 0, width: 0.5, height: 0.4 },
      { id: 's3', x: 0, y: 0.4, width: 0.333, height: 0.6 },
      { id: 's4', x: 0.333, y: 0.4, width: 0.333, height: 0.6 },
      { id: 's5', x: 0.666, y: 0.4, width: 0.334, height: 0.6 },
    ],
  },

  // --- 6 PHOTOS ---
  {
    id: 'layout-6-grid',
    name: '2×3 Editorial Grid',
    photoCount: 6,
    style: 'grid',
    aspectRatio: '4:5',
    slots: [
      { id: 's1', x: 0, y: 0, width: 0.5, height: 0.333 },
      { id: 's2', x: 0.5, y: 0, width: 0.5, height: 0.333 },
      { id: 's3', x: 0, y: 0.333, width: 0.5, height: 0.333 },
      { id: 's4', x: 0.5, y: 0.333, width: 0.5, height: 0.333 },
      { id: 's5', x: 0, y: 0.666, width: 0.5, height: 0.334 },
      { id: 's6', x: 0.5, y: 0.666, width: 0.5, height: 0.334 },
    ],
  },

  // --- 7 PHOTOS ---
  {
    id: 'layout-7-scrapbook',
    name: 'Center Hero + 6 Border',
    photoCount: 7,
    style: 'scrapbook',
    aspectRatio: '1:1',
    slots: [
      { id: 's1', x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
      { id: 's2', x: 0, y: 0, width: 0.25, height: 0.5 },
      { id: 's3', x: 0.25, y: 0, width: 0.5, height: 0.25 },
      { id: 's4', x: 0.75, y: 0, width: 0.25, height: 0.5 },
      { id: 's5', x: 0, y: 0.5, width: 0.25, height: 0.5 },
      { id: 's6', x: 0.25, y: 0.75, width: 0.5, height: 0.25 },
      { id: 's7', x: 0.75, y: 0.5, width: 0.25, height: 0.5 },
    ],
  },

  // --- 8 PHOTOS ---
  {
    id: 'layout-8-filmstrip',
    name: 'Dual Filmstrip 8-Photo',
    photoCount: 8,
    style: 'filmstrip',
    aspectRatio: '16:9',
    slots: [
      { id: 's1', x: 0, y: 0, width: 0.25, height: 0.5 },
      { id: 's2', x: 0.25, y: 0, width: 0.25, height: 0.5 },
      { id: 's3', x: 0.5, y: 0, width: 0.25, height: 0.5 },
      { id: 's4', x: 0.75, y: 0, width: 0.25, height: 0.5 },
      { id: 's5', x: 0, y: 0.5, width: 0.25, height: 0.5 },
      { id: 's6', x: 0.25, y: 0.5, width: 0.25, height: 0.5 },
      { id: 's7', x: 0.5, y: 0.5, width: 0.25, height: 0.5 },
      { id: 's8', x: 0.75, y: 0.5, width: 0.25, height: 0.5 },
    ],
  },

  // --- 9 PHOTOS ---
  {
    id: 'layout-9-square',
    name: '3×3 Instagram Grid',
    photoCount: 9,
    style: 'grid',
    aspectRatio: '1:1',
    slots: [
      { id: 's1', x: 0, y: 0, width: 0.333, height: 0.333 },
      { id: 's2', x: 0.333, y: 0, width: 0.333, height: 0.333 },
      { id: 's3', x: 0.666, y: 0, width: 0.334, height: 0.333 },
      { id: 's4', x: 0, y: 0.333, width: 0.333, height: 0.333 },
      { id: 's5', x: 0.333, y: 0.333, width: 0.333, height: 0.333 },
      { id: 's6', x: 0.666, y: 0.333, width: 0.334, height: 0.333 },
      { id: 's7', x: 0, y: 0.666, width: 0.333, height: 0.334 },
      { id: 's8', x: 0.333, y: 0.666, width: 0.333, height: 0.334 },
      { id: 's9', x: 0.666, y: 0.666, width: 0.334, height: 0.334 },
    ],
  },

  // --- 10+ PHOTOS ---
  {
    id: 'layout-12-contact-sheet',
    name: '35mm Contact Sheet (12 Photos)',
    photoCount: 12,
    style: 'filmstrip',
    aspectRatio: '4:5',
    slots: [
      { id: 's1', x: 0, y: 0, width: 0.333, height: 0.25 },
      { id: 's2', x: 0.333, y: 0, width: 0.333, height: 0.25 },
      { id: 's3', x: 0.666, y: 0, width: 0.334, height: 0.25 },
      { id: 's4', x: 0, y: 0.25, width: 0.333, height: 0.25 },
      { id: 's5', x: 0.333, y: 0.25, width: 0.333, height: 0.25 },
      { id: 's6', x: 0.666, y: 0.25, width: 0.334, height: 0.25 },
      { id: 's7', x: 0, y: 0.5, width: 0.333, height: 0.25 },
      { id: 's8', x: 0.333, y: 0.5, width: 0.333, height: 0.25 },
      { id: 's9', x: 0.666, y: 0.5, width: 0.334, height: 0.25 },
      { id: 's10', x: 0, y: 0.75, width: 0.333, height: 0.25 },
      { id: 's11', x: 0.333, y: 0.75, width: 0.333, height: 0.25 },
      { id: 's12', x: 0.666, y: 0.75, width: 0.334, height: 0.25 },
    ],
  },
];

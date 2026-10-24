export interface SampleImage {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  meta: string;
  url: string;
  aspect: string;
}

export const SAMPLE_IMAGES: SampleImage[] = [
  {
    id: 'sample-mountain',
    title: 'Alpine Dusk Ridge',
    subtitle: 'Dramatic jagged peaks & atmospheric mist',
    category: 'Landscape',
    meta: '48MP RAW • DCI-P3 • ISO 100',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80',
    aspect: '4:5',
  },
  {
    id: 'sample-kyoto',
    title: 'Kyoto Rain Dusk',
    subtitle: 'Lantern reflections & neon alleyways',
    category: 'Street & Neon',
    meta: '35mm f/1.4 • ISO 160 • 1/250s',
    url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1600&q=80',
    aspect: '4:5',
  },
  {
    id: 'sample-brutalism',
    title: 'Nordic Brutalism',
    subtitle: 'Concrete architectural geometry & shadows',
    category: 'Architecture',
    meta: 'DNG • ISO 64 • 1/1000s',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=80',
    aspect: '4:5',
  },
  {
    id: 'sample-dunes',
    title: 'Namib Dunes 04',
    subtitle: 'Golden hour sand ripples & amber light',
    category: 'Landscape',
    meta: 'ProRAW • ISO 100 • 1/500s',
    url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1600&q=80',
    aspect: '4:5',
  },
  {
    id: 'sample-portrait',
    title: 'Studio Melanin Glow',
    subtitle: 'Editorial portrait with soft studio rim light',
    category: 'Portrait',
    meta: '85mm f/1.2 • ISO 100 • 1/400s',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1600&q=80',
    aspect: '4:5',
  },
];

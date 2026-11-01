export interface AdjustmentParameters {
  // Tone
  exposure: number;       // -2.00 to +2.00 EV (default 0)
  brightness: number;     // -100 to +100 (default 0)
  contrast: number;       // -100 to +100 (default 0)
  highlights: number;     // -100 to +100 (default 0)
  shadows: number;        // -100 to +100 (default 0)
  whites: number;         // -100 to +100 (default 0)
  blacks: number;         // -100 to +100 (default 0)

  // Color
  temperature: number;    // -100 (cool) to +100 (warm)
  tint: number;           // -100 (green) to +100 (magenta)
  saturation: number;     // -100 to +100
  vibrance: number;       // -100 to +100
  hue: number;            // -180 to +180

  // Detail & Texture
  clarity: number;        // -100 to +100
  sharpen: number;        // 0 to 100
  blur: number;           // 0 to 100

  // Effects
  vignette: number;       // 0 to 100
  grain: number;          // 0 to 100
  fade: number;           // 0 to 100
}

export interface CurvePoint {
  x: number; // 0 to 255
  y: number; // 0 to 255
}

export interface ToneCurves {
  rgb: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
}

export interface ColorWheelAdjustment {
  hue: number;        // 0 to 360
  saturation: number; // 0 to 100
  luminance: number;  // -100 to 100
}

export interface ColorWheels {
  shadows: ColorWheelAdjustment;
  midtones: ColorWheelAdjustment;
  highlights: ColorWheelAdjustment;
}

export interface GeometryState {
  crop: {
    x: number;      // 0 to 1 (normalized)
    y: number;      // 0 to 1
    width: number;  // 0 to 1
    height: number; // 0 to 1
    aspectRatio: string; // 'free', '1:1', '4:5', '16:9', '9:16', '3:2', '4:3'
  };
  rotation: number; // in degrees (0, 90, 180, 270 or free)
  flipH: boolean;
  flipV: boolean;
}

export type TemplateCategory =
  | 'All'
  | 'Cinematic'
  | 'Portrait'
  | 'Vintage Film'
  | 'Black & White'
  | 'Golden Hour'
  | 'Moody'
  | 'Pastel'
  | 'Travel'
  | 'Food'
  | 'Street Photography'
  | 'Social Media';

export interface PhotoTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  tags: string[];
  defaultIntensity: number; // 0 to 100 (default 100)
  parameters: Partial<AdjustmentParameters>;
  wheels?: Partial<ColorWheels>;
  curves?: Partial<ToneCurves>;
  badge?: string;
  thumbnailGradient?: string;
  isCustom?: boolean;
}

export type Preset = PhotoTemplate;

export type ProjectSyncStatus =
  | 'local_only'
  | 'pending_upload'
  | 'syncing'
  | 'synced'
  | 'conflict'
  | 'failed';

export interface Project {
  id: string;
  name: string;
  type?: 'photo' | 'template' | 'collage' | 'carousel';
  imageSrc: string; // Base64 or object URL
  originalName: string;
  width: number;
  height: number;
  fileSize: number;
  createdAt: number;
  updatedAt: number;
  adjustments: AdjustmentParameters;
  activePresetId: string | null;
  presetIntensity: number; // 0 - 100
  geometry: GeometryState;
  curves: ToneCurves;
  wheels: ColorWheels;
  thumbnail?: string;
  // Cloud Sync Metadata
  syncStatus?: ProjectSyncStatus;
  cloudVersion?: number;
  cloudUpdatedAt?: number;
  lastSyncedAt?: number;
  userId?: string;
  syncError?: string;
  thumbnailPath?: string;
}

export type EditorTab = 'looks' | 'adjust' | 'crop' | 'colorlab' | 'curves' | 'effects';

export interface DominantColor {
  hex: string;
  rgb: [number, number, number];
  percentage: number;
  name?: string;
}

export interface ExportSettings {
  format: 'jpeg' | 'png' | 'webp';
  quality: number; // 0.1 to 1.0
  scale: number;   // 0.5, 0.75, 1, 1.5, 2
  stripMetadata: boolean;
}

export interface HistogramData {
  r: number[];
  g: number[];
  b: number[];
  l: number[];
  maxCount: number;
}

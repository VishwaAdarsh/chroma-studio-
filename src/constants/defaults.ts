import {
  AdjustmentParameters,
  BackgroundReplacementState,
  ColorWheels,
  CutoutState,
  GeometryState,
  HslAdjustments,
  ToneCurves,
} from '../types/editor';

export const DEFAULT_ADJUSTMENTS: AdjustmentParameters = {
  exposure: 0,
  brightness: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temperature: 0,
  tint: 0,
  saturation: 0,
  vibrance: 0,
  hue: 0,
  clarity: 0,
  sharpen: 0,
  blur: 0,
  noiseReduction: 0,
  vignette: 0,
  grain: 0,
  fade: 0,
};

export const DEFAULT_HSL: HslAdjustments = {
  red: { hue: 0, saturation: 0, luminance: 0 },
  orange: { hue: 0, saturation: 0, luminance: 0 },
  yellow: { hue: 0, saturation: 0, luminance: 0 },
  green: { hue: 0, saturation: 0, luminance: 0 },
  aqua: { hue: 0, saturation: 0, luminance: 0 },
  blue: { hue: 0, saturation: 0, luminance: 0 },
  purple: { hue: 0, saturation: 0, luminance: 0 },
  magenta: { hue: 0, saturation: 0, luminance: 0 },
};

export const DEFAULT_GEOMETRY: GeometryState = {
  crop: {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    aspectRatio: 'free',
  },
  rotation: 0,
  flipH: false,
  flipV: false,
};

export const DEFAULT_CURVES: ToneCurves = {
  rgb: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
};

export const DEFAULT_WHEELS: ColorWheels = {
  shadows: { hue: 0, saturation: 0, luminance: 0 },
  midtones: { hue: 0, saturation: 0, luminance: 0 },
  highlights: { hue: 0, saturation: 0, luminance: 0 },
};

export const DEFAULT_CUTOUT: CutoutState = {
  enabled: false,
  mode: 'auto',
  tolerance: 35,
  feather: 4,
  invert: false,
  matteColor: '#ffffff',
};

export const DEFAULT_BACKGROUND_REPLACEMENT: BackgroundReplacementState = {
  enabled: false,
  mode: 'color',
  color: '#FFFFFF',
  bgTransform: {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    fit: 'cover',
    blur: 0,
  },
  fgTransform: {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  },
  feather: 2,
};

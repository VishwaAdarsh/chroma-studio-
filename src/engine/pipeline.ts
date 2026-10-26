import {
  AdjustmentParameters,
  ColorWheels,
  DominantColor,
  GeometryState,
  HistogramData,
  Preset,
  ToneCurves,
} from '../types/editor';

function clampAdjustmentParam(key: keyof AdjustmentParameters, value: number): number {
  switch (key) {
    case 'exposure':
      return Math.max(-2, Math.min(2, value));
    case 'hue':
      return Math.max(-180, Math.min(180, value));
    case 'blur':
    case 'sharpen':
    case 'vignette':
    case 'grain':
    case 'fade':
      return Math.max(0, Math.min(100, value));
    default:
      return Math.max(-100, Math.min(100, value));
  }
}

/**
 * Interpolates preset/template parameters, wheels, and curves with base adjustments
 * according to template intensity (0..100).
 * At intensity 0, returns the neutral base adjustments without template contributions.
 */
export function blendPresetAdjustments(
  base: AdjustmentParameters,
  preset: Preset | null,
  intensity: number,
  baseWheels?: ColorWheels,
  baseCurves?: ToneCurves
): {
  adjustments: AdjustmentParameters;
  wheels?: ColorWheels;
  curves?: ToneCurves;
} {
  if (!preset || intensity === 0) {
    return {
      adjustments: { ...base },
      wheels: baseWheels ? { ...baseWheels } : undefined,
      curves: baseCurves ? { ...baseCurves } : undefined,
    };
  }

  const factor = Math.max(0, Math.min(1, intensity / 100));
  const blended: AdjustmentParameters = { ...base };

  const presetParams = preset.parameters;
  for (const key in presetParams) {
    const paramKey = key as keyof AdjustmentParameters;
    const pVal = presetParams[paramKey];
    if (typeof pVal === 'number') {
      const bVal = base[paramKey] || 0;
      blended[paramKey] = clampAdjustmentParam(paramKey, bVal + pVal * factor);
    }
  }

  // Blend Color Wheels
  let blendedWheels: ColorWheels | undefined = baseWheels ? { ...baseWheels } : undefined;
  if (preset.wheels) {
    const bw = baseWheels || {
      shadows: { hue: 0, saturation: 0, luminance: 0 },
      midtones: { hue: 0, saturation: 0, luminance: 0 },
      highlights: { hue: 0, saturation: 0, luminance: 0 },
    };

    blendedWheels = {
      shadows: {
        hue: bw.shadows.saturation > 0 ? bw.shadows.hue : preset.wheels.shadows?.hue || 0,
        saturation: Math.min(100, (bw.shadows.saturation || 0) + (preset.wheels.shadows?.saturation || 0) * factor),
        luminance: Math.max(-100, Math.min(100, (bw.shadows.luminance || 0) + (preset.wheels.shadows?.luminance || 0) * factor)),
      },
      midtones: {
        hue: bw.midtones.saturation > 0 ? bw.midtones.hue : preset.wheels.midtones?.hue || 0,
        saturation: Math.min(100, (bw.midtones.saturation || 0) + (preset.wheels.midtones?.saturation || 0) * factor),
        luminance: Math.max(-100, Math.min(100, (bw.midtones.luminance || 0) + (preset.wheels.midtones?.luminance || 0) * factor)),
      },
      highlights: {
        hue: bw.highlights.saturation > 0 ? bw.highlights.hue : preset.wheels.highlights?.hue || 0,
        saturation: Math.min(100, (bw.highlights.saturation || 0) + (preset.wheels.highlights?.saturation || 0) * factor),
        luminance: Math.max(-100, Math.min(100, (bw.highlights.luminance || 0) + (preset.wheels.highlights?.luminance || 0) * factor)),
      },
    };
  }

  // Blend Tone Curves
  let blendedCurves: ToneCurves | undefined = baseCurves ? { ...baseCurves } : undefined;
  if (preset.curves) {
    const channels: (keyof ToneCurves)[] = ['rgb', 'red', 'green', 'blue'];
    const resultCurves: Partial<ToneCurves> = baseCurves ? { ...baseCurves } : {};

    channels.forEach((channel) => {
      const templatePoints = preset.curves?.[channel];
      if (templatePoints && templatePoints.length > 0) {
        // Interpolate deflection from neutral diagonal (x = y)
        resultCurves[channel] = templatePoints.map((pt) => ({
          x: pt.x,
          y: Math.max(0, Math.min(255, Math.round(pt.x + (pt.y - pt.x) * factor))),
        }));
      }
    });

    blendedCurves = resultCurves as ToneCurves;
  }

  return { adjustments: blended, wheels: blendedWheels, curves: blendedCurves };
}

/**
 * Builds a 256-entry lookup table (LUT) from tone curve control points
 */
export function buildCurveLUT(points: { x: number; y: number }[]): Uint8Array {
  const lut = new Uint8Array(256);
  if (!points || points.length === 0) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  const sorted = [...points].sort((a, b) => a.x - b.x);

  // Linear / piecewise interpolation between control points
  let currentIdx = 0;
  for (let i = 0; i < 256; i++) {
    while (currentIdx < sorted.length - 2 && sorted[currentIdx + 1].x < i) {
      currentIdx++;
    }
    const p1 = sorted[currentIdx];
    const p2 = sorted[currentIdx + 1] || p1;

    if (p1.x === p2.x) {
      lut[i] = Math.max(0, Math.min(255, Math.round(p1.y)));
    } else {
      const t = (i - p1.x) / (p2.x - p1.x);
      const val = p1.y + t * (p2.y - p1.y);
      lut[i] = Math.max(0, Math.min(255, Math.round(val)));
    }
  }

  return lut;
}

/**
 * Converts RGB to HSL and back for color split toning
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

/**
 * Fast 1D Separable Box Blur for Luminance channel
 */
export function boxBlurLuminance(lum: Float32Array, w: number, h: number, radius: number): Float32Array {
  const temp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const r = Math.max(1, Math.floor(radius));

  // Horizontal blur: lum -> temp
  for (let y = 0; y < h; y++) {
    const rowOffset = y * w;
    let sum = 0;
    for (let k = -r; k <= r; k++) {
      const px = Math.min(w - 1, Math.max(0, k));
      sum += lum[rowOffset + px];
    }
    const windowSize = 2 * r + 1;
    temp[rowOffset] = sum / windowSize;

    for (let x = 1; x < w; x++) {
      const prevX = Math.max(0, x - 1 - r);
      const nextX = Math.min(w - 1, x + r);
      sum += lum[rowOffset + nextX] - lum[rowOffset + prevX];
      temp[rowOffset + x] = sum / windowSize;
    }
  }

  // Vertical blur: temp -> out
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let k = -r; k <= r; k++) {
      const py = Math.min(h - 1, Math.max(0, k));
      sum += temp[py * w + x];
    }
    const windowSize = 2 * r + 1;
    out[x] = sum / windowSize;

    for (let y = 1; y < h; y++) {
      const prevY = Math.max(0, y - 1 - r);
      const nextY = Math.min(h - 1, y + r);
      sum += temp[nextY * w + x] - temp[prevY * w + x];
      out[y * w + x] = sum / windowSize;
    }
  }

  return out;
}

/**
 * Applies Clarity (Local Midtone Contrast Enhancement)
 * Enhances micro-contrast in the midtones using local high-frequency difference
 * with a sinusoidal weighting bell curve that tapers to 0 at shadows and highlights.
 */
export function applyClarity(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  clarity: number
): void {
  if (clarity === 0 || w <= 0 || h <= 0) return;

  const len = w * h;
  const lum = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const idx = i * 4;
    lum[i] = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
  }

  const radius = Math.max(2, Math.min(16, Math.round(Math.min(w, h) / 100)));
  const blurred = boxBlurLuminance(lum, w, h, radius);

  const factor = (clarity / 100) * 1.5;
  for (let i = 0; i < len; i++) {
    const idx = i * 4;
    const l = lum[i];
    const diff = l - blurred[i];
    // Sinusoidal midtone bell curve: peak at midtones, 0 at extremes
    const u = Math.max(0, Math.min(1, l / 255));
    const midtoneWeight = Math.sin(Math.PI * u);
    const delta = diff * factor * midtoneWeight;

    data[idx] = Math.max(0, Math.min(255, data[idx] + delta));
    data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + delta));
    data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + delta));
  }
}

/**
 * Applies Sharpen (Discrete Laplacian Edge Acutance Kernel)
 * Enhances edge definition while preserving alpha transparency and clamping to [0, 255].
 */
export function applySharpen(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  sharpen: number
): void {
  if (sharpen <= 0 || w <= 0 || h <= 0) return;

  const k = (sharpen / 100) * 0.6;
  if (k <= 0) return;

  const src = new Uint8ClampedArray(data);
  for (let y = 0; y < h; y++) {
    const yUp = y > 0 ? y - 1 : 0;
    const yDown = y < h - 1 ? y + 1 : h - 1;
    const rowOffset = y * w;
    const upOffset = yUp * w;
    const downOffset = yDown * w;

    for (let x = 0; x < w; x++) {
      const xLeft = x > 0 ? x - 1 : 0;
      const xRight = x < w - 1 ? x + 1 : w - 1;

      const center = (rowOffset + x) * 4;
      const top = (upOffset + x) * 4;
      const bottom = (downOffset + x) * 4;
      const left = (rowOffset + xLeft) * 4;
      const right = (rowOffset + xRight) * 4;

      for (let c = 0; c < 3; c++) {
        const val =
          (1 + 4 * k) * src[center + c] -
          k * (src[top + c] + src[bottom + c] + src[left + c] + src[right + c]);
        data[center + c] = Math.max(0, Math.min(255, Math.round(val)));
      }
    }
  }
}

/**
 * Main rendering pipeline
 */
export function processImage(
  sourceImage: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  adjustments: AdjustmentParameters,
  geometry: GeometryState,
  curves?: ToneCurves,
  wheels?: ColorWheels,
  targetCanvas?: HTMLCanvasElement,
  exportScale: number = 1
): {
  canvas: HTMLCanvasElement;
  histogram: HistogramData;
  dominantColors: DominantColor[];
} {
  const canvas = targetCanvas || document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2D canvas context');

  // 1. Calculate Crop and Output Dimensions
  const crop = geometry.crop;
  const cropX = Math.max(0, Math.min(sourceWidth, crop.x * sourceWidth));
  const cropY = Math.max(0, Math.min(sourceHeight, crop.y * sourceHeight));
  const cropW = Math.max(1, Math.min(sourceWidth - cropX, crop.width * sourceWidth));
  const cropH = Math.max(1, Math.min(sourceHeight - cropY, crop.height * sourceHeight));

  const isRotated90or270 = Math.abs(geometry.rotation % 180) === 90;
  const targetW = Math.round((isRotated90or270 ? cropH : cropW) * exportScale);
  const targetH = Math.round((isRotated90or270 ? cropW : cropH) * exportScale);

  canvas.width = Math.max(1, targetW);
  canvas.height = Math.max(1, targetH);

  // 2. Apply Geometric Transformations (Crop, Rotate, Flip)
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((geometry.rotation * Math.PI) / 180);
  ctx.scale(geometry.flipH ? -1 : 1, geometry.flipV ? -1 : 1);

  const drawW = (isRotated90or270 ? canvas.height : canvas.width);
  const drawH = (isRotated90or270 ? canvas.width : canvas.height);

  ctx.drawImage(
    sourceImage,
    cropX,
    cropY,
    cropW,
    cropH,
    -drawW / 2,
    -drawH / 2,
    drawW,
    drawH
  );
  ctx.restore();

  // 3. Pixel Manipulation for Non-Destructive Adjustments
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const len = data.length;

  // Pre-calculate curve LUTs
  const rgbLUT = curves ? buildCurveLUT(curves.rgb) : null;
  const redLUT = curves ? buildCurveLUT(curves.red) : null;
  const greenLUT = curves ? buildCurveLUT(curves.green) : null;
  const blueLUT = curves ? buildCurveLUT(curves.blue) : null;

  // Pre-calculate adjustment constants
  const expFactor = Math.pow(2, adjustments.exposure);
  const brightnessOffset = adjustments.brightness * 2.55;
  const contrastFactor = (259 * (adjustments.contrast + 255)) / (255 * (259 - adjustments.contrast));
  const tempOffset = adjustments.temperature * 1.2;
  const tintOffset = adjustments.tint * 1.2;
  const satFactor = 1 + adjustments.saturation / 100;
  const vibFactor = adjustments.vibrance / 100;
  const highlightOffset = adjustments.highlights / 100;
  const shadowOffset = adjustments.shadows / 100;
  const whiteOffset = adjustments.whites * 1.5;
  const blackOffset = adjustments.blacks * 1.5;
  const fadeLift = adjustments.fade * 1.2;
  const grainAmount = adjustments.grain / 100;

  // Split-toning color tint vectors & luminance deltas
  let shadowTintR = 0, shadowTintG = 0, shadowTintB = 0;
  let midtoneTintR = 0, midtoneTintG = 0, midtoneTintB = 0;
  let highlightTintR = 0, highlightTintG = 0, highlightTintB = 0;
  let shadowLumDelta = 0, midtoneLumDelta = 0, highlightLumDelta = 0;

  if (wheels) {
    if (wheels.shadows && wheels.shadows.saturation > 0) {
      const [r, g, b] = hslToRgb(wheels.shadows.hue, wheels.shadows.saturation / 100, 0.5);
      shadowTintR = (r - 128) / 128;
      shadowTintG = (g - 128) / 128;
      shadowTintB = (b - 128) / 128;
    }
    if (wheels.midtones && wheels.midtones.saturation > 0) {
      const [r, g, b] = hslToRgb(wheels.midtones.hue, wheels.midtones.saturation / 100, 0.5);
      midtoneTintR = (r - 128) / 128;
      midtoneTintG = (g - 128) / 128;
      midtoneTintB = (b - 128) / 128;
    }
    if (wheels.highlights && wheels.highlights.saturation > 0) {
      const [r, g, b] = hslToRgb(wheels.highlights.hue, wheels.highlights.saturation / 100, 0.5);
      highlightTintR = (r - 128) / 128;
      highlightTintG = (g - 128) / 128;
      highlightTintB = (b - 128) / 128;
    }

    shadowLumDelta = ((wheels.shadows?.luminance || 0) / 100) * 50;
    midtoneLumDelta = ((wheels.midtones?.luminance || 0) / 100) * 50;
    highlightLumDelta = ((wheels.highlights?.luminance || 0) / 100) * 50;
  }

  // Histogram buckets
  const histR = new Array(256).fill(0);
  const histG = new Array(256).fill(0);
  const histB = new Array(256).fill(0);
  const histL = new Array(256).fill(0);
  let maxCount = 0;

  // Dominant color sampling
  const colorSamples: { [hex: string]: { rgb: [number, number, number]; count: number } } = {};
  const sampleStep = Math.max(1, Math.floor(len / 4 / 2000)); // Sample ~2000 pixels
  let totalSampled = 0;

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // 1. Exposure
    if (expFactor !== 1) {
      r *= expFactor;
      g *= expFactor;
      b *= expFactor;
    }

    // 2. Brightness
    if (brightnessOffset !== 0) {
      r += brightnessOffset;
      g += brightnessOffset;
      b += brightnessOffset;
    }

    // 3. Contrast
    if (adjustments.contrast !== 0) {
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;
    }

    // Calculate current luminance (ITU-R BT.709)
    let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // 4. Highlights & Shadows
    if (highlightOffset !== 0 && lum > 128) {
      const weight = (lum - 128) / 127;
      const boost = highlightOffset * weight * 60;
      r += boost;
      g += boost;
      b += boost;
    }
    if (shadowOffset !== 0 && lum < 128) {
      const weight = (128 - lum) / 128;
      const boost = shadowOffset * weight * 60;
      r += boost;
      g += boost;
      b += boost;
    }

    // 5. Whites & Blacks
    if (whiteOffset !== 0 && lum > 180) {
      const weight = (lum - 180) / 75;
      r += whiteOffset * weight;
      g += whiteOffset * weight;
      b += whiteOffset * weight;
    }
    if (blackOffset !== 0 && lum < 80) {
      const weight = (80 - lum) / 80;
      r += blackOffset * weight;
      g += blackOffset * weight;
      b += blackOffset * weight;
    }

    // 6. Temperature (Warm/Cool) & Tint (Green/Magenta)
    if (tempOffset !== 0) {
      r += tempOffset;
      b -= tempOffset;
    }
    if (tintOffset !== 0) {
      g -= tintOffset * 0.7;
      r += tintOffset * 0.4;
      b += tintOffset * 0.3;
    }

    // Recalculate luminance after tone adjustments
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // 7. Saturation & Vibrance
    if (satFactor !== 1 || vibFactor !== 0) {
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const currentSat = maxC === 0 ? 0 : (maxC - minC) / maxC;

      // Vibrance affects desaturated colors more than already saturated ones
      const vibMult = 1 + vibFactor * (1 - currentSat);
      const totalSat = satFactor * vibMult;

      r = lum + (r - lum) * totalSat;
      g = lum + (g - lum) * totalSat;
      b = lum + (b - lum) * totalSat;
    }

    // 8. Color Wheels Split Toning & 3-Way Luminance
    const u = Math.max(0, Math.min(1, lum / 255));
    const shadowWeight = Math.max(0, 1 - 2 * u);
    const midtoneWeight = Math.sin(Math.PI * u);
    const highlightWeight = Math.max(0, 2 * u - 1);

    if (shadowTintR !== 0 || shadowTintG !== 0 || shadowTintB !== 0) {
      r += shadowTintR * shadowWeight * 50;
      g += shadowTintG * shadowWeight * 50;
      b += shadowTintB * shadowWeight * 50;
    }
    if (midtoneTintR !== 0 || midtoneTintG !== 0 || midtoneTintB !== 0) {
      r += midtoneTintR * midtoneWeight * 50;
      g += midtoneTintG * midtoneWeight * 50;
      b += midtoneTintB * midtoneWeight * 50;
    }
    if (highlightTintR !== 0 || highlightTintG !== 0 || highlightTintB !== 0) {
      r += highlightTintR * highlightWeight * 50;
      g += highlightTintG * highlightWeight * 50;
      b += highlightTintB * highlightWeight * 50;
    }

    if (shadowLumDelta !== 0) {
      r += shadowLumDelta * shadowWeight;
      g += shadowLumDelta * shadowWeight;
      b += shadowLumDelta * shadowWeight;
    }
    if (midtoneLumDelta !== 0) {
      r += midtoneLumDelta * midtoneWeight;
      g += midtoneLumDelta * midtoneWeight;
      b += midtoneLumDelta * midtoneWeight;
    }
    if (highlightLumDelta !== 0) {
      r += highlightLumDelta * highlightWeight;
      g += highlightLumDelta * highlightWeight;
      b += highlightLumDelta * highlightWeight;
    }

    // 9. Tone Curves LUT
    if (rgbLUT) {
      const clampR = Math.max(0, Math.min(255, Math.round(r)));
      const clampG = Math.max(0, Math.min(255, Math.round(g)));
      const clampB = Math.max(0, Math.min(255, Math.round(b)));
      r = rgbLUT[clampR];
      g = rgbLUT[clampG];
      b = rgbLUT[clampB];
    }
    if (redLUT) r = redLUT[Math.max(0, Math.min(255, Math.round(r)))];
    if (greenLUT) g = greenLUT[Math.max(0, Math.min(255, Math.round(g)))];
    if (blueLUT) b = blueLUT[Math.max(0, Math.min(255, Math.round(b)))];

    // 10. Fade (Lift black point)
    if (fadeLift > 0) {
      r = r + (255 - r) * (fadeLift / 255) * (1 - lum / 255);
      g = g + (255 - g) * (fadeLift / 255) * (1 - lum / 255);
      b = b + (255 - b) * (fadeLift / 255) * (1 - lum / 255);
    }

    // 11. Film Grain
    if (grainAmount > 0) {
      const noise = (Math.random() - 0.5) * grainAmount * 60;
      r += noise;
      g += noise;
      b += noise;
    }

    // Final clamp to 0..255
    const finalR = Math.max(0, Math.min(255, Math.round(r)));
    const finalG = Math.max(0, Math.min(255, Math.round(g)));
    const finalB = Math.max(0, Math.min(255, Math.round(b)));
    const finalL = Math.max(0, Math.min(255, Math.round(0.2126 * finalR + 0.7152 * finalG + 0.0722 * finalB)));

    data[i] = finalR;
    data[i + 1] = finalG;
    data[i + 2] = finalB;

    // Histogram accumulation
    histR[finalR]++;
    histG[finalG]++;
    histB[finalB]++;
    histL[finalL]++;
    if (histL[finalL] > maxCount) maxCount = histL[finalL];

    // Color sampling
    if ((i / 4) % sampleStep === 0) {
      // Quantize to 32 steps per channel for clustering
      const qR = Math.floor(finalR / 32) * 32;
      const qG = Math.floor(finalG / 32) * 32;
      const qB = Math.floor(finalB / 32) * 32;
      const hex = `#${qR.toString(16).padStart(2, '0')}${qG.toString(16).padStart(2, '0')}${qB.toString(16).padStart(2, '0')}`;
      if (!colorSamples[hex]) {
        colorSamples[hex] = { rgb: [finalR, finalG, finalB], count: 0 };
      }
      colorSamples[hex].count++;
      totalSampled++;
    }
  }

  // 12. Clarity (Local midtone contrast enhancement)
  if (adjustments.clarity !== 0) {
    applyClarity(data, canvas.width, canvas.height, adjustments.clarity);
  }

  // 13. Sharpen (Edge acutance convolution)
  if (adjustments.sharpen > 0) {
    applySharpen(data, canvas.width, canvas.height, adjustments.sharpen);
  }

  // Write pixel data back to canvas
  ctx.putImageData(imgData, 0, 0);

  // 14. Vignette (Post-pass radial gradient)
  if (adjustments.vignette > 0) {
    const w = canvas.width;
    const h = canvas.height;
    const radius = Math.sqrt(Math.pow(w / 2, 2) + Math.pow(h / 2, 2));
    const vigGradient = ctx.createRadialGradient(
      w / 2,
      h / 2,
      radius * 0.4,
      w / 2,
      h / 2,
      radius
    );
    const alpha = (adjustments.vignette / 100) * 0.85;
    vigGradient.addColorStop(0, 'rgba(0,0,0,0)');
    vigGradient.addColorStop(1, `rgba(0,0,0,${alpha})`);

    ctx.save();
    ctx.fillStyle = vigGradient;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // 15. Canvas filter blur
  if (adjustments.blur > 0) {
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = canvas.width;
    blurCanvas.height = canvas.height;
    const bCtx = blurCanvas.getContext('2d');
    if (bCtx) {
      bCtx.filter = `blur(${adjustments.blur * 0.15}px)`;
      bCtx.drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(blurCanvas, 0, 0);
    }
  }

  // Extract top dominant colors
  const dominantColors: DominantColor[] = Object.entries(colorSamples)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(([hex, data]) => ({
      hex,
      rgb: data.rgb,
      percentage: totalSampled > 0 ? Math.round((data.count / totalSampled) * 100) : 0,
    }));

  return {
    canvas,
    histogram: {
      r: histR,
      g: histG,
      b: histB,
      l: histL,
      maxCount: Math.max(1, maxCount),
    },
    dominantColors,
  };
}

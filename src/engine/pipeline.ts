import {
  AdjustmentParameters,
  ColorWheels,
  DominantColor,
  GeometryState,
  HistogramData,
  Preset,
  ToneCurves,
} from '../types/editor';

/**
 * Interpolates preset parameters with base adjustments according to preset intensity (0..100)
 */
export function blendPresetAdjustments(
  base: AdjustmentParameters,
  preset: Preset | null,
  intensity: number
): { adjustments: AdjustmentParameters; wheels?: ColorWheels } {
  if (!preset || intensity === 0) {
    return { adjustments: { ...base } };
  }

  const factor = Math.max(0, Math.min(1, intensity / 100));
  const blended: AdjustmentParameters = { ...base };

  const presetParams = preset.parameters;
  for (const key in presetParams) {
    const paramKey = key as keyof AdjustmentParameters;
    const pVal = presetParams[paramKey];
    if (typeof pVal === 'number') {
      const bVal = base[paramKey] || 0;
      blended[paramKey] = bVal + pVal * factor;
    }
  }

  let blendedWheels: ColorWheels | undefined = undefined;
  if (preset.wheels) {
    blendedWheels = {
      shadows: {
        hue: preset.wheels.shadows?.hue || 0,
        saturation: (preset.wheels.shadows?.saturation || 0) * factor,
        luminance: (preset.wheels.shadows?.luminance || 0) * factor,
      },
      midtones: {
        hue: preset.wheels.midtones?.hue || 0,
        saturation: (preset.wheels.midtones?.saturation || 0) * factor,
        luminance: (preset.wheels.midtones?.luminance || 0) * factor,
      },
      highlights: {
        hue: preset.wheels.highlights?.hue || 0,
        saturation: (preset.wheels.highlights?.saturation || 0) * factor,
        luminance: (preset.wheels.highlights?.luminance || 0) * factor,
      },
    };
  }

  return { adjustments: blended, wheels: blendedWheels };
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

  // Split-toning color tint vectors
  let shadowTintR = 0, shadowTintG = 0, shadowTintB = 0;
  let highlightTintR = 0, highlightTintG = 0, highlightTintB = 0;

  if (wheels) {
    if (wheels.shadows.saturation > 0) {
      const [r, g, b] = hslToRgb(wheels.shadows.hue, wheels.shadows.saturation / 100, 0.5);
      shadowTintR = (r - 128) / 128;
      shadowTintG = (g - 128) / 128;
      shadowTintB = (b - 128) / 128;
    }
    if (wheels.highlights.saturation > 0) {
      const [r, g, b] = hslToRgb(wheels.highlights.hue, wheels.highlights.saturation / 100, 0.5);
      highlightTintR = (r - 128) / 128;
      highlightTintG = (g - 128) / 128;
      highlightTintB = (b - 128) / 128;
    }
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

    // 8. Color Wheels Split Toning
    if (shadowTintR !== 0 || shadowTintG !== 0 || shadowTintB !== 0) {
      const shadowWeight = Math.max(0, 1 - lum / 128);
      r += shadowTintR * shadowWeight * 50;
      g += shadowTintG * shadowWeight * 50;
      b += shadowTintB * shadowWeight * 50;
    }
    if (highlightTintR !== 0 || highlightTintG !== 0 || highlightTintB !== 0) {
      const highlightWeight = Math.max(0, (lum - 128) / 127);
      r += highlightTintR * highlightWeight * 50;
      g += highlightTintG * highlightWeight * 50;
      b += highlightTintB * highlightWeight * 50;
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

  // 12. Vignette (Post-pass radial gradient)
  ctx.putImageData(imgData, 0, 0);

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

  // 13. Clarity / Sharpening / Blur
  if (adjustments.blur > 0) {
    // Note: Canvas filter blur
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

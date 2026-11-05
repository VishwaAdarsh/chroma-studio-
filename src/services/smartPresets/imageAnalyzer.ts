// Chroma Studio — Photometric Image Analyzer
// Extracts luminance, contrast, color temperature, and scene heuristics in real-time (<10ms).

import type { ImageAnalysisMetrics } from './types';

export class ImageAnalyzer {
  public static analyze(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): ImageAnalysisMetrics {
    const totalPixels = width * height;
    if (totalPixels === 0 || data.length === 0) {
      return this.getDefaultMetrics();
    }

    // Dynamic stride: sample at most ~12,000 pixels for lightning fast <5ms execution
    const stride = Math.max(1, Math.floor(Math.sqrt(totalPixels / 12000)));

    let sumL = 0;
    let sumL2 = 0;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let sumSat = 0;

    let skinCount = 0;
    let greeneryCount = 0;
    let skyCount = 0;
    let goldenHourCount = 0;
    let sampledCount = 0;

    const hist = new Uint32Array(256);

    for (let y = 0; y < height; y += stride) {
      const yRow = y * width;
      const isUpperHalf = y < height * 0.55;

      for (let x = 0; x < width; x += stride) {
        const idx = (yRow + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        if (a < 20) continue; // Skip transparent pixels

        // Photometric luminance (ITU-R BT.601)
        const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        hist[l]++;

        sumL += l;
        sumL2 += l * l;
        sumR += r;
        sumG += g;
        sumB += b;

        // Saturation metric
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const sat = maxC > 0 ? (maxC - minC) / maxC : 0;
        sumSat += sat;

        // 1. Human skin tone heuristic: R > G > B with warm chromaticity and midtone luminance
        if (r > g && g > b && r - g >= 14 && r - b >= 20 && l >= 45 && l <= 220) {
          skinCount++;
        }

        // 2. Greenery / nature heuristic: G dominant over R and B
        if (g > r && g > b && g - r >= 8 && g - b >= 12) {
          greeneryCount++;
        }

        // 3. Sky heuristic: B dominant in upper half of frame
        if (isUpperHalf && b > r && b >= g && b - r >= 14) {
          skyCount++;
        }

        // 4. Golden hour / sunset heuristic: High warm highlights
        if (r >= 170 && g >= 110 && b <= 130 && r > b * 1.3) {
          goldenHourCount++;
        }

        sampledCount++;
      }
    }

    if (sampledCount === 0) {
      return this.getDefaultMetrics();
    }

    const meanL = sumL / sampledCount;
    const varianceL = Math.max(0, sumL2 / sampledCount - meanL * meanL);
    const stdDevL = Math.sqrt(varianceL);

    // Compute 1st and 99th percentiles
    let cumulative = 0;
    const p1Target = sampledCount * 0.01;
    const p99Target = sampledCount * 0.99;
    let p1 = 0;
    let p99 = 255;
    let p1Found = false;

    for (let i = 0; i < 256; i++) {
      cumulative += hist[i];
      if (!p1Found && cumulative >= p1Target) {
        p1 = i;
        p1Found = true;
      }
      if (cumulative >= p99Target) {
        p99 = i;
        break;
      }
    }

    const avgR = sumR / sampledCount;
    const avgB = sumB / sampledCount;
    const avgSat = (sumSat / sampledCount) * 100;

    const skinRatio = skinCount / sampledCount;
    const greeneryRatio = greeneryCount / sampledCount;
    const skyRatio = skyCount / sampledCount;
    const goldenHourRatio = goldenHourCount / sampledCount;

    // Classify characteristics
    const contrast = Math.round(Math.min(100, stdDevL * 1.45));
    const dynamicRange = p99 - p1 > 190 ? 'high' : p99 - p1 < 95 ? 'low' : 'normal';

    const tempRatio = avgR / Math.max(1, avgB);
    const colorTemperature = tempRatio > 1.15 ? 'warm' : tempRatio < 0.88 ? 'cool' : 'neutral';

    const isLowKey = meanL < 75;
    const isHighKey = meanL > 175;

    const isPortraitCandidate = skinRatio >= 0.09;
    const isLandscapeCandidate = greeneryRatio >= 0.08 || skyRatio >= 0.12;
    const isGoldenHourCandidate = goldenHourRatio >= 0.08;

    let dominantHueFamily: ImageAnalysisMetrics['dominantHueFamily'] = 'neutral';
    if (avgSat < 14) {
      dominantHueFamily = 'monochrome';
    } else if (greeneryRatio >= 0.15) {
      dominantHueFamily = 'greenery';
    } else if (colorTemperature === 'warm') {
      dominantHueFamily = 'warm';
    } else if (colorTemperature === 'cool') {
      dominantHueFamily = 'cool';
    }

    return {
      meanLuminance: Math.round(meanL),
      contrast,
      dynamicRange,
      colorTemperature,
      saturationScore: Math.round(avgSat),
      isLowKey,
      isHighKey,
      isPortraitCandidate,
      isLandscapeCandidate,
      isGoldenHourCandidate,
      dominantHueFamily,
    };
  }

  private static getDefaultMetrics(): ImageAnalysisMetrics {
    return {
      meanLuminance: 128,
      contrast: 50,
      dynamicRange: 'normal',
      colorTemperature: 'neutral',
      saturationScore: 50,
      isLowKey: false,
      isHighKey: false,
      isPortraitCandidate: false,
      isLandscapeCandidate: false,
      isGoldenHourCandidate: false,
      dominantHueFamily: 'neutral',
    };
  }
}

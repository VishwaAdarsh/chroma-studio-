// Chroma Studio — Smart Preset Recommender Service
// Analyzes photo characteristics and curates intelligent preset recommendations with clear explanations.

import { ImageAnalyzer } from './imageAnalyzer';
import type {
  ImageAnalysisMetrics,
  PresetRecommendation,
  SmartPresetOptions,
  SmartPresetResult,
  SmartPresetEngine,
} from './types';
import { PRESETS } from '../../data/presets';
import { supabase } from '../../lib/supabase';

export class SmartPresetService implements SmartPresetEngine {
  async recommendPresets(
    source:
      | ImageData
      | HTMLImageElement
      | HTMLCanvasElement
      | { data: Uint8ClampedArray; width: number; height: number },
    options: SmartPresetOptions = {}
  ): Promise<SmartPresetResult> {
    const startTime = performance.now();
    const { provider = 'auto', userConsent = false, signal, onProgress } = options;

    if (signal?.aborted) {
      throw new DOMException('Analysis cancelled by user', 'AbortError');
    }

    onProgress?.(15, 'Extracting photometric pixel buffer...');

    // 1. Extract ImageData buffer
    const pixelData = this.extractImageData(source);

    onProgress?.(45, 'Computing luminance, contrast & color temperature metrics...');
    if (signal?.aborted) {
      throw new DOMException('Analysis cancelled by user', 'AbortError');
    }

    // 2. Run high-performance photometric analysis (<5ms)
    const metrics = ImageAnalyzer.analyze(pixelData.data, pixelData.width, pixelData.height);

    // 3. Check for Cloud Vision Recommendation if requested with user consent
    if (provider !== 'deterministic' && userConsent && navigator.onLine && supabase) {
      try {
        onProgress?.(70, 'Querying Cloud Vision aesthetic matcher...');
        if (signal?.aborted) {
          throw new DOMException('Analysis cancelled by user', 'AbortError');
        }

        const { data, error } = await supabase.functions.invoke('ai-preset-rec', {
          body: {
            metrics,
            sampleWidth: pixelData.width,
            sampleHeight: pixelData.height,
          },
        });

        if (!error && data?.recommendations && data.recommendations.length > 0) {
          onProgress?.(100, 'Smart preset recommendations ready');
          const durationMs = Math.round(performance.now() - startTime);

          const matchedPresets: PresetRecommendation[] = data.recommendations
            .map((rec: any) => {
              const p = PRESETS.find((item) => item.id === rec.presetId);
              if (!p) return null;
              return {
                preset: p,
                matchScore: rec.matchScore || 95,
                category: p.category,
                reason: rec.reason || `Recommended for ${p.category.toLowerCase()} photography.`,
                suggestedIntensity: p.defaultIntensity || 100,
                provider: 'cloud-ai',
              };
            })
            .filter(Boolean) as PresetRecommendation[];

          if (matchedPresets.length > 0) {
            return {
              recommendations: matchedPresets,
              metrics,
              provider: 'cloud-ai',
              durationMs,
              explanation: data.explanation || 'Curated using Cloud AI multimodal vision match.',
            };
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
        console.warn('Cloud preset recommender unreachable, utilizing analytical matcher:', err);
      }
    }

    // 4. Deterministic Rule-Based Matching Engine
    onProgress?.(85, 'Evaluating curated preset affinities...');
    if (signal?.aborted) {
      throw new DOMException('Analysis cancelled by user', 'AbortError');
    }

    const recommendations = this.scoreAndRankPresets(metrics);

    onProgress?.(100, 'Smart preset recommendations ready');
    const durationMs = Math.round(performance.now() - startTime);

    return {
      recommendations,
      metrics,
      provider: 'deterministic-analysis',
      durationMs,
      explanation: this.generateOverallExplanation(metrics),
    };
  }

  /**
   * Deterministically scores each preset in the library against image metrics.
   */
  private scoreAndRankPresets(metrics: ImageAnalysisMetrics): PresetRecommendation[] {
    const scored: Array<{
      preset: typeof PRESETS[0];
      score: number;
      reason: string;
      suggestedIntensity: number;
    }> = [];

    for (const preset of PRESETS) {
      let score = 55;
      let reason = preset.description;

      const cat = preset.category;
      const tags = preset.tags || [];

      // Affinity 1: Human Portrait
      if (metrics.isPortraitCandidate) {
        if (cat === 'Portrait') {
          score += 34;
          reason = 'Skin tones detected. Softens harsh highlights while enhancing natural facial warmth.';
        } else if (tags.includes('skin') || tags.includes('portrait')) {
          score += 22;
          reason = 'Complements human subjects with flattering skin luminance.';
        }
      }

      // Affinity 2: Golden Hour / Sunset
      if (metrics.isGoldenHourCandidate || (metrics.dominantHueFamily === 'warm' && metrics.dynamicRange === 'high')) {
        if (cat === 'Golden Hour') {
          score += 36;
          reason = 'Radiant golden highlights detected. Enriches warm amber glow across the frame.';
        } else if (preset.id === 'cine-teal-orange') {
          score += 32;
          reason = 'Blockbuster complementary teal shadows harmonize with warm sunset highlights.';
        }
      }

      // Affinity 3: Outdoor Landscape & Greenery
      if (metrics.isLandscapeCandidate || metrics.dominantHueFamily === 'greenery') {
        if (cat === 'Travel' || tags.includes('nature') || tags.includes('landscape')) {
          score += 32;
          reason = 'Natural foliage and sky detected. Boosts vibrant greens and horizon dynamic range.';
        }
      }

      // Affinity 4: Low-Key / Moody / Night Scenes
      if (metrics.isLowKey) {
        if (cat === 'Moody' || preset.id === 'cine-gold500t') {
          score += 32;
          reason = 'Low-key atmospheric lighting detected. Balances deep shadow depth with subtle halation.';
        }
      }

      // Affinity 5: High-Key / Bright Scenes
      if (metrics.isHighKey) {
        if (cat === 'Pastel' || cat === 'Vintage Film') {
          score += 28;
          reason = 'High-key airy brightness detected. Gently lifts midtones while preserving highlight clarity.';
        }
      }

      // Affinity 6: Subdued Saturation / Monochrome Candidate
      if (metrics.dominantHueFamily === 'monochrome' || metrics.saturationScore < 18) {
        if (cat === 'Black & White') {
          score += 38;
          reason = 'Subdued color palette detected. Translates tonal values into timeless analog black & white.';
        }
      }

      // Affinity 7: Low native contrast (needs punch)
      if (metrics.contrast < 40 && (cat === 'Cinematic' || cat === 'Social Media')) {
        score += 20;
        reason = 'Soft native contrast detected. Injects micro-contrast acutance and punchy separation.';
      }

      // Affinity 8: Cool scene compensation
      if (metrics.colorTemperature === 'cool' && (tags.includes('warm') || preset.id === 'cine-teal-orange')) {
        score += 18;
        reason = 'Cool ambient cast detected. Warms highlights for balanced color harmony.';
      }

      // Clamp score between 60 and 99
      const finalScore = Math.min(98, Math.max(62, score));
      scored.push({
        preset,
        score: finalScore,
        reason,
        suggestedIntensity: preset.defaultIntensity || 100,
      });
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Pick top recommendations while enforcing category diversity
    const chosen: PresetRecommendation[] = [];
    const seenCategories = new Set<string>();

    for (const item of scored) {
      if (chosen.length >= 4) break;
      if (!seenCategories.has(item.preset.category) || chosen.length < 2) {
        seenCategories.add(item.preset.category);
        chosen.push({
          preset: item.preset,
          matchScore: item.score,
          category: item.preset.category,
          reason: item.reason,
          suggestedIntensity: item.suggestedIntensity,
          provider: 'deterministic-analysis',
        });
      }
    }

    // Fallback if diversity filtering was too strict
    if (chosen.length < 3) {
      for (const item of scored) {
        if (chosen.length >= 4) break;
        if (!chosen.some((c) => c.preset.id === item.preset.id)) {
          chosen.push({
            preset: item.preset,
            matchScore: item.score,
            category: item.preset.category,
            reason: item.reason,
            suggestedIntensity: item.suggestedIntensity,
            provider: 'deterministic-analysis',
          });
        }
      }
    }

    return chosen;
  }

  private generateOverallExplanation(m: ImageAnalysisMetrics): string {
    const sceneTokens: string[] = [];
    if (m.isPortraitCandidate) sceneTokens.push('portrait skin tones');
    if (m.isGoldenHourCandidate) sceneTokens.push('golden hour warmth');
    if (m.isLandscapeCandidate) sceneTokens.push('natural foliage & horizon');
    if (m.isLowKey) sceneTokens.push('moody low-key shadows');
    if (m.isHighKey) sceneTokens.push('bright high-key exposure');
    if (m.dominantHueFamily === 'monochrome') sceneTokens.push('monochrome palette');

    const desc = sceneTokens.length > 0 ? sceneTokens.join(', ') : `${m.colorTemperature} tone with ${m.contrast}% contrast`;
    return `Analyzed image profile: ${desc}. Recommended looks tailored to this scene.`;
  }

  private extractImageData(
    source:
      | ImageData
      | HTMLImageElement
      | HTMLCanvasElement
      | { data: Uint8ClampedArray; width: number; height: number }
  ): { data: Uint8ClampedArray; width: number; height: number } {
    if ('data' in source && 'width' in source && 'height' in source && source.data instanceof Uint8ClampedArray) {
      return {
        data: source.data,
        width: source.width,
        height: source.height,
      };
    }

    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      let w = 0;
      let h = 0;

      if ('naturalWidth' in source) {
        w = (source as HTMLImageElement).naturalWidth || (source as HTMLImageElement).width;
        h = (source as HTMLImageElement).naturalHeight || (source as HTMLImageElement).height;
      } else if ('width' in source) {
        w = (source as HTMLCanvasElement).width;
        h = (source as HTMLCanvasElement).height;
      }

      if (w > 0 && h > 0) {
        // Constrain max analysis dimension to 800px for speed
        const maxDim = 800;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          return { data: imgData.data, width: canvas.width, height: canvas.height };
        }
      }
    }

    throw new Error('Unsupported source format for smart preset analysis');
  }
}

export const smartPresetService = new SmartPresetService();

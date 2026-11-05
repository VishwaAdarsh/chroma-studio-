import type { AdjustmentParameters } from '../../types/editor';
import { PRESETS } from '../../data/presets';
import type { AiEditPlan, AiEditRequest, AiProvider } from './types';
import { clampParameter, calculateParameterDiffs } from './schema';

/**
 * High-performance, on-device semantic natural language intent parser.
 * Maps photographic terminology and conversational instructions into calibrated Chroma Studio adjustment recipes.
 */
export class LocalSemanticAiProvider implements AiProvider {
  name = 'Local Semantic Assistant (On-Device)';

  async isAvailable(): Promise<boolean> {
    return true; // Always available on-device
  }

  async generateEditPlan(request: AiEditRequest): Promise<AiEditPlan> {
    const rawPrompt = request.prompt.trim().toLowerCase();
    const current = request.currentAdjustments;

    // 1. Guardrail against unsupported generative actions (object replacement, generative inpainting, text generation)
    const unsupportedPatterns = [
      /\b(remove|erase|delete)\s+(the\s+)?(person|people|car|dog|cat|object|building|tree|face|text|blemish|watermark)\b/i,
      /\b(replace|swap)\s+(the\s+)?(background|face|sky|shirt|hair)\b/i,
      /\b(add|insert|draw|generate)\s+(a|an)?\s*(dog|cat|person|tree|car|sunset|clouds|alien|dragon)\b/i,
      /\b(change|dye)\s+(hair|eye|skin)\s+color\b/i,
      /\b(make\s+me|turn\s+into)\b/i,
    ];

    for (const pattern of unsupportedPatterns) {
      if (pattern.test(rawPrompt)) {
        return {
          explanation:
            'Generative object replacement and inpainting require generative diffusion models outside Chroma Studio’s current photo grading engine.',
          parameters: {},
          supported: false,
          unsupportedReason:
            'Chroma Studio currently specializes in non-destructive color grading, tone balancing, texture enhancement, and boundary background removal.',
          suggestedAlternatives: [
            'Use the "Cutout" tab to isolate the subject or remove uniform backgrounds.',
            'Use the "Color Lab" (HSL mixer) to selectively adjust or shift specific color hues.',
            'Use "Adjust" or "Curves" to alter lighting, shadows, and mood.',
          ],
        };
      }
    }

    const proposed: Partial<AdjustmentParameters> = { ...current };
    const explanationParts: string[] = [];
    let suggestedPresetId: string | undefined;
    let suggestedPresetIntensity: number | undefined;

    // 2. Specific multi-turn or preset styles
    if (/\b(cinematic|movie|hollywood|blockbuster)\b/i.test(rawPrompt)) {
      const cinePreset = PRESETS.find((p) => p.category === 'Cinematic' || p.id === 'cine-teal-orange');
      if (cinePreset) {
        suggestedPresetId = cinePreset.id;
        suggestedPresetIntensity = 85;
        explanationParts.push('Applied cinematic grade with teal-tinted shadows and warm skin tone preservation');
      } else {
        proposed.contrast = clampParameter('contrast', current.contrast + 22);
        proposed.highlights = clampParameter('highlights', current.highlights - 15);
        proposed.shadows = clampParameter('shadows', current.shadows + 12);
        proposed.clarity = clampParameter('clarity', current.clarity + 14);
        proposed.vignette = clampParameter('vignette', Math.max(current.vignette, 18));
        explanationParts.push('Enhanced contrast, softened highlights, lifted shadows, and added subtle cinematic vignette');
      }
    }

    if (/\b(vintage|retro|analog|film|nostalgic)\b/i.test(rawPrompt)) {
      const vintagePreset = PRESETS.find((p) => p.category === 'Vintage Film' || p.id.includes('vintage') || p.id.includes('kodak'));
      if (vintagePreset) {
        suggestedPresetId = vintagePreset.id;
        suggestedPresetIntensity = 80;
        explanationParts.push('Selected vintage analog film profile with organic grain and gentle highlight halation');
      } else {
        proposed.fade = clampParameter('fade', Math.max(current.fade, 25));
        proposed.grain = clampParameter('grain', Math.max(current.grain, 28));
        proposed.temperature = clampParameter('temperature', current.temperature + 12);
        proposed.contrast = clampParameter('contrast', current.contrast - 10);
        explanationParts.push('Lifted black levels for film fade, added fine grain texture, and introduced warm analog tone');
      }
    }

    if (/\b(black\s*and\s*white|b&w|monochrome|grayscale)\b/i.test(rawPrompt)) {
      const bwPreset = PRESETS.find((p) => p.category === 'Black & White' || p.id.includes('bw') || p.id.includes('mono'));
      if (bwPreset) {
        suggestedPresetId = bwPreset.id;
        suggestedPresetIntensity = 100;
        proposed.saturation = -100;
        explanationParts.push('Transformed into deep monochrome fine-art style with tonal balance');
      } else {
        proposed.saturation = -100;
        proposed.contrast = clampParameter('contrast', current.contrast + 24);
        proposed.clarity = clampParameter('clarity', current.clarity + 15);
        explanationParts.push('Completely desaturated color and expanded luminance contrast for dramatic black and white');
      }
    }

    if (/\b(moody|dark\s*and\s*moody)\b/i.test(rawPrompt) || (/\b(dramatic)\b/i.test(rawPrompt) && !suggestedPresetId && proposed.saturation !== -100)) {
      proposed.exposure = clampParameter('exposure', current.exposure - 0.35);
      proposed.contrast = clampParameter('contrast', current.contrast + 20);
      proposed.shadows = clampParameter('shadows', current.shadows - 15);
      proposed.vignette = clampParameter('vignette', Math.max(current.vignette, 24));
      proposed.saturation = clampParameter('saturation', current.saturation - 10);
      explanationParts.push('Deepened exposure and shadows, boosted contrast, and framed with dramatic vignette');
    }

    if (/\b(golden\s*hour|sunset|warm\s*glow|sunlit)\b/i.test(rawPrompt)) {
      proposed.temperature = clampParameter('temperature', current.temperature + 35);
      proposed.tint = clampParameter('tint', current.tint + 6);
      proposed.vibrance = clampParameter('vibrance', current.vibrance + 18);
      proposed.highlights = clampParameter('highlights', current.highlights - 12);
      explanationParts.push('Infused rich golden hour warmth with boosted vibrance and soft highlight roll-off');
    }

    if (/\b(pastel|dreamy|soft)\b/i.test(rawPrompt)) {
      proposed.contrast = clampParameter('contrast', current.contrast - 18);
      proposed.highlights = clampParameter('highlights', current.highlights - 15);
      proposed.shadows = clampParameter('shadows', current.shadows + 25);
      proposed.fade = clampParameter('fade', Math.max(current.fade, 18));
      proposed.vibrance = clampParameter('vibrance', current.vibrance + 14);
      explanationParts.push('Softened overall contrast, lifted shadows, and gave a gentle pastel aesthetic');
    }

    // 3. Granular Tone & Lighting adjustments
    // Warmth / Temperature
    if (/\b(warm|warmer|warmth|more\s*warm)\b/i.test(rawPrompt) && !suggestedPresetId) {
      const step = /\b(slightly|subtly|a\s*bit|little)\b/i.test(rawPrompt) ? 15 : 28;
      proposed.temperature = clampParameter('temperature', current.temperature + step);
      explanationParts.push(`Shifted white balance warmer (+${step}%)`);
    } else if (/\b(cool|cooler|coolness|colder|blue\s*tone)\b/i.test(rawPrompt)) {
      const step = /\b(slightly|subtly|a\s*bit|little)\b/i.test(rawPrompt) ? -15 : -28;
      proposed.temperature = clampParameter('temperature', current.temperature + step);
      explanationParts.push(`Shifted white balance cooler (${step}%)`);
    }

    // Brightness / Exposure
    if (/\b(bright|brighter|lighten|more\s*light|increase\s*exposure)\b/i.test(rawPrompt)) {
      const step = /\b(slightly|subtly|a\s*bit|little)\b/i.test(rawPrompt) ? 0.25 : 0.45;
      proposed.exposure = clampParameter('exposure', current.exposure + step);
      proposed.brightness = clampParameter('brightness', current.brightness + 8);
      explanationParts.push(`Lifted exposure by +${step} EV`);
    } else if (/\b(dark|darker|dim|decrease\s*exposure|less\s*light)\b/i.test(rawPrompt)) {
      const step = /\b(slightly|subtly|a\s*bit|little)\b/i.test(rawPrompt) ? -0.25 : -0.45;
      proposed.exposure = clampParameter('exposure', current.exposure + step);
      explanationParts.push(`Lowered exposure by ${step} EV`);
    }

    // Contrast
    if (/\b(contrast|punchy|crisp|more\s*contrast|pop)\b/i.test(rawPrompt)) {
      const step = /\b(slightly|subtly|a\s*bit)\b/i.test(rawPrompt) ? 14 : 26;
      proposed.contrast = clampParameter('contrast', current.contrast + step);
      explanationParts.push(`Boosted contrast (+${step}%)`);
    } else if (/\b(less\s*contrast|flat|matte|muted\s*contrast)\b/i.test(rawPrompt)) {
      const step = /\b(slightly|subtly|a\s*bit)\b/i.test(rawPrompt) ? -14 : -24;
      proposed.contrast = clampParameter('contrast', current.contrast + step);
      explanationParts.push(`Reduced contrast (${step}%)`);
    }

    // Highlights
    if (/\b(reduce|pull|recover|lower|mute|muted)\s*(the\s*)?highlights\b/i.test(rawPrompt)) {
      proposed.highlights = clampParameter('highlights', Math.min(current.highlights - 28, -20));
      explanationParts.push('Softened highlights for clean tonal roll-off');
    } else if (/\b(boost|increase|more)\s*(the\s*)?highlights\b/i.test(rawPrompt)) {
      proposed.highlights = clampParameter('highlights', current.highlights + 25);
      explanationParts.push('Enhanced highlights for radiant brightness');
    }

    // Shadows
    if (/\b(lift|raise|open|brighten)\s*(the\s*)?shadows\b/i.test(rawPrompt)) {
      proposed.shadows = clampParameter('shadows', Math.max(current.shadows + 28, 20));
      explanationParts.push('Lifted shadows to reveal hidden shadow texture');
    } else if (/\b(crush|deepen|darker)\s*(the\s*)?shadows\b/i.test(rawPrompt)) {
      proposed.shadows = clampParameter('shadows', current.shadows - 25);
      explanationParts.push('Deepened shadows for richer depth');
    }

    // Skin Tone Preservation
    if (/\b(preserve|protect)\s*(the\s*)?skin\s*tones?\b/i.test(rawPrompt)) {
      proposed.vibrance = clampParameter('vibrance', current.vibrance + 8);
      proposed.temperature = clampParameter('temperature', current.temperature + 4);
      explanationParts.push('Preserved natural skin tones by protecting midtone chroma');
    }

    // Saturation & Vibrance
    if (/\b(saturat|colorful|vibrant|boost\s*color)\b/i.test(rawPrompt) && !/\b(reduce|lower|less)\s*(the\s*)?saturation\b/i.test(rawPrompt)) {
      proposed.vibrance = clampParameter('vibrance', current.vibrance + 22);
      proposed.saturation = clampParameter('saturation', current.saturation + 12);
      explanationParts.push('Boosted vibrance and color saturation');
    } else if (
      /\b(desaturat|muted\s*color|subdued|less\s*saturated|reduce\s*(the\s*)?saturation|lower\s*(the\s*)?saturation)\b/i.test(rawPrompt) &&
      proposed.saturation !== -100
    ) {
      const step = /\b(slightly|subtly|a\s*bit|little)\b/i.test(rawPrompt) ? -15 : -25;
      proposed.saturation = clampParameter('saturation', current.saturation + step);
      explanationParts.push(`Toned down saturation (${step}%)`);
    }

    // Sharpness, Clarity, Denoise, Vignette, Grain
    if (/\b(sharp|sharpen|crisp\s*edges)\b/i.test(rawPrompt)) {
      proposed.sharpen = clampParameter('sharpen', Math.max(current.sharpen, 35));
      proposed.clarity = clampParameter('clarity', current.clarity + 14);
      explanationParts.push('Sharpened details and micro-contrast');
    }

    if (/\b(denoise|noise\s*reduction|clean\s*grain|smooth\s*noise)\b/i.test(rawPrompt)) {
      proposed.noiseReduction = clampParameter('noiseReduction', Math.max(current.noiseReduction, 45));
      explanationParts.push('Applied bilateral noise reduction smoothing');
    }

    if (/\b(vignette|dark\s*edges|frame\s*edges)\b/i.test(rawPrompt)) {
      proposed.vignette = clampParameter('vignette', Math.max(current.vignette, 28));
      explanationParts.push('Added peripheral vignette framing');
    }

    if (/\b(grain|film\s*grain|texture)\b/i.test(rawPrompt)) {
      proposed.grain = clampParameter('grain', Math.max(current.grain, 32));
      explanationParts.push('Added organic film grain texture');
    }

    // Fallback if prompt was completely generic or unrecognized
    if (explanationParts.length === 0 && !suggestedPresetId) {
      proposed.exposure = clampParameter('exposure', current.exposure + 0.15);
      proposed.contrast = clampParameter('contrast', current.contrast + 10);
      proposed.vibrance = clampParameter('vibrance', current.vibrance + 12);
      explanationParts.push('Balanced exposure, enhanced gentle contrast, and refreshed color vibrance');
    }

    // Calculate parameter diffs
    const diffs = calculateParameterDiffs(current, proposed);

    return {
      explanation: explanationParts.join('. ') + '.',
      parameters: proposed,
      presetId: suggestedPresetId,
      presetIntensity: suggestedPresetIntensity,
      supported: true,
      diffs,
    };
  }
}

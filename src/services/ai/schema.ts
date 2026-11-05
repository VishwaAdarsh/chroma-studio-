import type { AdjustmentParameters } from '../../types/editor';
import { PRESETS } from '../../data/presets';
import type {
  AiEditPlan,
  AiParameterCorrection,
  AiParameterDiff,
  AiResponseValidationResult,
} from './types';

export const PARAM_LIMITS: Record<
  keyof AdjustmentParameters,
  { min: number; max: number; unit: string; step: number }
> = {
  exposure: { min: -2.0, max: 2.0, unit: 'EV', step: 0.05 },
  brightness: { min: -100, max: 100, unit: '%', step: 1 },
  contrast: { min: -100, max: 100, unit: '%', step: 1 },
  highlights: { min: -100, max: 100, unit: '%', step: 1 },
  shadows: { min: -100, max: 100, unit: '%', step: 1 },
  whites: { min: -100, max: 100, unit: '%', step: 1 },
  blacks: { min: -100, max: 100, unit: '%', step: 1 },
  temperature: { min: -100, max: 100, unit: '%', step: 1 },
  tint: { min: -100, max: 100, unit: '%', step: 1 },
  saturation: { min: -100, max: 100, unit: '%', step: 1 },
  vibrance: { min: -100, max: 100, unit: '%', step: 1 },
  hue: { min: -180, max: 180, unit: '°', step: 1 },
  clarity: { min: -100, max: 100, unit: '%', step: 1 },
  sharpen: { min: 0, max: 100, unit: '%', step: 1 },
  blur: { min: 0, max: 100, unit: '%', step: 1 },
  noiseReduction: { min: 0, max: 100, unit: '%', step: 1 },
  vignette: { min: 0, max: 100, unit: '%', step: 1 },
  grain: { min: 0, max: 100, unit: '%', step: 1 },
  fade: { min: 0, max: 100, unit: '%', step: 1 },
};

const VALID_PARAM_KEYS = new Set<string>(Object.keys(PARAM_LIMITS));
const VALID_PRESET_IDS = new Set<string>(PRESETS.map((p) => p.id));

/**
 * Computes parameter differences between current adjustments and proposed AI adjustments
 */
export function calculateParameterDiffs(
  current: AdjustmentParameters,
  proposed: Partial<AdjustmentParameters>
): AiParameterDiff[] {
  const diffs: AiParameterDiff[] = [];

  for (const [key, val] of Object.entries(proposed)) {
    if (!VALID_PARAM_KEYS.has(key) || typeof val !== 'number') continue;
    const paramKey = key as keyof AdjustmentParameters;
    const currentVal = current[paramKey] ?? 0;
    const proposedVal = val;
    const delta = Math.round((proposedVal - currentVal) * 100) / 100;

    if (Math.abs(delta) > 0.001) {
      diffs.push({
        param: paramKey,
        current: currentVal,
        proposed: proposedVal,
        delta,
        unit: PARAM_LIMITS[paramKey]?.unit || '',
      });
    }
  }

  return diffs;
}

/**
 * Clamps a single adjustment parameter to its valid physical limits
 */
export function clampParameter(key: keyof AdjustmentParameters, value: number): number {
  const limit = PARAM_LIMITS[key];
  if (!limit) return 0;
  if (!Number.isFinite(value) || Number.isNaN(value)) return 0;

  const clamped = Math.max(limit.min, Math.min(limit.max, value));
  return key === 'exposure' ? Math.round(clamped * 100) / 100 : Math.round(clamped);
}

/**
 * Sanitizes and strictly validates any raw AI output structure
 */
export function validateAndSanitizeAiPlan(
  raw: unknown,
  currentAdjustments?: AdjustmentParameters
): AiResponseValidationResult {
  const warnings: string[] = [];
  const corrections: AiParameterCorrection[] = [];
  let sanitized = false;

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      valid: false,
      plan: {
        explanation: 'Invalid AI response payload received from provider.',
        parameters: {},
        supported: false,
        unsupportedReason: 'Malformed response structure from AI model.',
        suggestedAlternatives: ['Try rephrasing your editing request.'],
      },
      sanitized: true,
      warnings: ['Received non-object response from AI provider'],
    };
  }

  const obj = raw as Record<string, unknown>;

  // Check supported flag
  const supported = obj.supported !== false;
  if (!supported) {
    const reason =
      typeof obj.unsupportedReason === 'string' && obj.unsupportedReason.trim().length > 0
        ? obj.unsupportedReason.trim()
        : 'This editing operation is not currently supported by Chroma Studio grading tools.';

    const alternatives = Array.isArray(obj.suggestedAlternatives)
      ? obj.suggestedAlternatives.filter((s): s is string => typeof s === 'string' && s.length > 0)
      : ['Try color grading, tone adjustments, or background cutout instead.'];

    return {
      valid: true,
      plan: {
        explanation:
          typeof obj.explanation === 'string' && obj.explanation.trim().length > 0
            ? obj.explanation.trim()
            : 'Request outside tool capabilities.',
        parameters: {},
        supported: false,
        unsupportedReason: reason,
        suggestedAlternatives: alternatives,
      },
      sanitized: false,
    };
  }

  // Validate explanation
  let explanation = 'Adjustments prepared based on your instructions.';
  if (typeof obj.explanation === 'string' && obj.explanation.trim().length > 0) {
    // Strip any HTML tags or script injection
    explanation = obj.explanation.replace(/<[^>]*>?/gm, '').trim();
    if (explanation.length > 400) {
      explanation = explanation.substring(0, 397) + '...';
      sanitized = true;
      warnings.push('Explanation exceeded length limit and was truncated');
    }
  }

  // Validate parameters object (supports nested { parameters: {...} } or direct flat dictionary)
  const validParameters: Partial<AdjustmentParameters> = {};
  const rawParams =
    obj.parameters && typeof obj.parameters === 'object' && Object.keys(obj.parameters).length > 0
      ? (obj.parameters as Record<string, unknown>)
      : (obj as Record<string, unknown>);

  for (const [key, rawVal] of Object.entries(rawParams)) {
    if (!VALID_PARAM_KEYS.has(key)) {
      sanitized = true;
      const warn = `Ignored unsupported parameter key: "${key}"`;
      warnings.push(warn);
      corrections.push({
        param: key as any,
        originalValue: String(rawVal),
        correctedValue: 0,
        reason: `Unsupported parameter "${key}" was rejected. Only calibrated Chroma Studio parameters are permitted.`,
      });
      continue;
    }

    const paramKey = key as keyof AdjustmentParameters;
    const limit = PARAM_LIMITS[paramKey];
    let numericVal: number;

    if (typeof rawVal === 'number') {
      numericVal = rawVal;
    } else if (typeof rawVal === 'string') {
      numericVal = parseFloat(rawVal);
      if (Number.isNaN(numericVal)) {
        sanitized = true;
        warnings.push(`Invalid non-numeric value for "${key}": "${rawVal}"`);
        corrections.push({
          param: paramKey,
          originalValue: String(rawVal),
          correctedValue: 0,
          reason: `Invalid non-numeric value "${rawVal}" for "${key}" was discarded.`,
        });
        continue;
      }
      sanitized = true;
    } else {
      sanitized = true;
      warnings.push(`Ignored non-primitive value for parameter "${key}"`);
      continue;
    }

    const clamped = clampParameter(paramKey, numericVal);
    if (clamped !== numericVal) {
      sanitized = true;
      const reason = `Adjusted "${paramKey}" from ${numericVal} to ${clamped} ${limit.unit} to stay within real range [${limit.min}, ${limit.max}].`;
      warnings.push(reason);
      corrections.push({
        param: paramKey,
        originalValue: numericVal,
        correctedValue: clamped,
        reason,
      });
    }

    validParameters[paramKey] = clamped;
  }

  // Validate optional presetId
  let validatedPresetId: string | undefined;
  if (typeof obj.presetId === 'string' && obj.presetId.trim().length > 0) {
    const trimmedId = obj.presetId.trim();
    if (VALID_PRESET_IDS.has(trimmedId)) {
      validatedPresetId = trimmedId;
    } else {
      sanitized = true;
      warnings.push(`Preset ID "${trimmedId}" does not exist in preset catalog and was discarded`);
    }
  }

  // Validate optional presetIntensity
  let validatedPresetIntensity: number | undefined;
  if (validatedPresetId && typeof obj.presetIntensity === 'number') {
    validatedPresetIntensity = Math.max(0, Math.min(100, Math.round(obj.presetIntensity)));
  } else if (validatedPresetId) {
    validatedPresetIntensity = 100;
  }

  // Calculate diffs if current adjustments provided
  let diffs: AiParameterDiff[] | undefined;
  if (currentAdjustments) {
    diffs = calculateParameterDiffs(currentAdjustments, validParameters);
  }

  const finalPlan: AiEditPlan = {
    explanation,
    parameters: validParameters,
    presetId: validatedPresetId,
    presetIntensity: validatedPresetIntensity,
    supported: true,
    diffs,
    corrections: corrections.length > 0 ? corrections : undefined,
  };

  return {
    valid: true,
    plan: finalPlan,
    sanitized,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

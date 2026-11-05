import type { AdjustmentParameters } from '../../types/editor';

export interface AiEditRequest {
  prompt: string;
  currentAdjustments: AdjustmentParameters;
  currentPresetId?: string | null;
  currentPresetIntensity?: number;
  availablePresetIds?: string[];
}

export interface AiParameterDiff {
  param: keyof AdjustmentParameters;
  current: number;
  proposed: number;
  delta: number;
  unit: string;
}

export interface AiParameterCorrection {
  param: keyof AdjustmentParameters;
  originalValue: number | string;
  correctedValue: number;
  reason: string;
}

export interface AiEditPlan {
  explanation: string;
  parameters: Partial<AdjustmentParameters>;
  presetId?: string;
  presetIntensity?: number;
  supported: boolean;
  unsupportedReason?: string;
  suggestedAlternatives?: string[];
  diffs?: AiParameterDiff[];
  corrections?: AiParameterCorrection[];
}

export interface AiResponseValidationResult {
  valid: boolean;
  plan: AiEditPlan;
  sanitized: boolean;
  warnings?: string[];
}

export interface AiProvider {
  name: string;
  generateEditPlan(request: AiEditRequest, signal?: AbortSignal): Promise<AiEditPlan>;
  isAvailable(): Promise<boolean>;
}

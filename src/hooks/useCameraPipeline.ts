import type { DetectionBox } from '@/src/types';

export type CameraPipelineResult = {
  frameProcessor: undefined;
  modelLoaded: boolean;
  modelState: 'missing' | 'loading' | 'loaded' | 'error' | 'cloud';
};

export const MISSING_MODEL_PIPELINE: CameraPipelineResult = {
  frameProcessor: undefined,
  modelLoaded: false,
  modelState: 'missing',
};

export const CLOUD_PIPELINE: CameraPipelineResult = {
  frameProcessor: undefined,
  modelLoaded: true,
  modelState: 'cloud',
};

/**
 * Legacy stub — on-device TFLite has been replaced by cloud `detect-shot`.
 */
export function useCameraPipeline(
  _onDetections: (detections: DetectionBox[], frameWidth: number, frameHeight: number) => void,
  _enabled = true
): CameraPipelineResult {
  return CLOUD_PIPELINE;
}

export function isModelBundled(): boolean {
  return false;
}

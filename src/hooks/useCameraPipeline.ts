import type { ReadonlyFrameProcessor } from 'react-native-vision-camera';
import type { DetectionBox } from '@/src/types';
import { isModelAssetBundled } from '@/src/models/modelSource';

export type CameraPipelineResult = {
  frameProcessor: ReadonlyFrameProcessor | undefined;
  modelLoaded: boolean;
  modelState: 'missing' | 'loading' | 'loaded' | 'error';
};

export const MISSING_MODEL_PIPELINE: CameraPipelineResult = {
  frameProcessor: undefined,
  modelLoaded: false,
  modelState: 'missing',
};

/**
 * Stub hook kept for API compatibility. TFLite hooks run inside
 * `CameraPipelineHost` only when `basketball_detector.tflite` is bundled.
 */
export function useCameraPipeline(
  _onDetections: (detections: DetectionBox[], frameWidth: number, frameHeight: number) => void,
  _enabled = true
): CameraPipelineResult {
  return MISSING_MODEL_PIPELINE;
}

export function isModelBundled(): boolean {
  return isModelAssetBundled();
}

export { BASKETBALL_DETECTOR_MODEL } from '@/src/models/modelSource';

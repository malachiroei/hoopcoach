import type { ReadonlyFrameProcessor } from 'react-native-vision-camera';
import { useTfliteCameraPipeline } from '@/src/hooks/useTfliteCameraPipeline';
import type { FrameDetectionPayload } from '@/src/hooks/useTfliteFrameProcessor';
import { isModelAssetBundled } from '@/src/models/modelSource';

export type CameraPipelineResult = {
  frameProcessor: ReadonlyFrameProcessor | undefined;
  modelLoaded: boolean;
  modelState: 'missing' | 'loading' | 'loaded' | 'error';
  modelError?: unknown;
};

export const MISSING_MODEL_PIPELINE: CameraPipelineResult = {
  frameProcessor: undefined,
  modelLoaded: false,
  modelState: 'missing',
};

export function useCameraPipeline(
  onDetections: (payload: FrameDetectionPayload) => void,
  enabled = true,
): CameraPipelineResult {
  const pipeline = useTfliteCameraPipeline(onDetections, enabled && isModelAssetBundled());

  return {
    frameProcessor: pipeline.frameProcessor,
    modelLoaded: pipeline.modelLoaded,
    modelState: pipeline.modelState,
    modelError: pipeline.modelError,
  };
}

export function isModelBundled(): boolean {
  return isModelAssetBundled();
}

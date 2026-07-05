import { useTensorflowModel } from 'react-native-fast-tflite';
import type { DetectionBox } from '@/src/types';
import { ACTIVE_MODEL_ASSET } from '@/src/models/modelSource';
import { useTfliteFrameProcessor, type FrameDetectionPayload } from '@/src/hooks/useTfliteFrameProcessor';

export function useTfliteCameraPipeline(
  onDetections: (payload: FrameDetectionPayload) => void,
  enabled = true,
) {
  const modelAsset = ACTIVE_MODEL_ASSET;
  const model = useTensorflowModel(modelAsset ?? 0);

  const modelLoaded = modelAsset != null && model.state === 'loaded';
  const modelState =
    modelAsset == null
      ? ('missing' as const)
      : model.state === 'loading'
        ? ('loading' as const)
        : model.state === 'error'
          ? ('error' as const)
          : modelLoaded
            ? ('loaded' as const)
            : ('loading' as const);

  const frameProcessor = useTfliteFrameProcessor(
    modelLoaded ? model.model : undefined,
    onDetections,
    enabled && modelLoaded,
  );

  return {
    frameProcessor,
    modelLoaded,
    modelState,
    modelError: model.state === 'error' ? model.error : null,
  };
}

/** @deprecated Use FrameDetectionPayload */
export type LegacyDetectionCallback = (
  detections: DetectionBox[],
  frameWidth: number,
  frameHeight: number,
) => void;

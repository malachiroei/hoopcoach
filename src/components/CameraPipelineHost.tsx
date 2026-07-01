import { useEffect } from 'react';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { BASKETBALL_DETECTOR_MODEL, isModelAssetBundled } from '@/src/models/modelSource';
import { useTfliteFrameProcessor, type FrameDetectionPayload } from '@/src/hooks/useTfliteFrameProcessor';
import type { CameraPipelineResult } from '@/src/hooks/useCameraPipeline';

interface CameraPipelineHostProps {
  enabled: boolean;
  onDetections: (payload: FrameDetectionPayload) => void;
  onPipelineChange: (pipeline: CameraPipelineResult) => void;
}

/**
 * Loads the TFLite asset and mounts frame-processor hooks only after the model is ready.
 * Renders nothing; reports pipeline state to the parent via callback.
 */
export function CameraPipelineHost({
  enabled,
  onDetections,
  onPipelineChange,
}: CameraPipelineHostProps) {
  if (!isModelAssetBundled() || BASKETBALL_DETECTOR_MODEL == null) {
    return null;
  }

  return (
    <CameraPipelineHostInner
      modelAsset={BASKETBALL_DETECTOR_MODEL}
      enabled={enabled}
      onDetections={onDetections}
      onPipelineChange={onPipelineChange}
    />
  );
}

function CameraPipelineHostInner({
  modelAsset,
  enabled,
  onDetections,
  onPipelineChange,
}: CameraPipelineHostProps & { modelAsset: number }) {
  const detection = useTensorflowModel(modelAsset);
  const loadState = detection.state;

  useEffect(() => {
    if (loadState !== 'error') {
      return;
    }
    console.error('TFLITE_LOAD_ERROR:', detection.error ?? 'Tensorflow model failed to load');
  }, [loadState, detection.error]);

  useEffect(() => {
    if (loadState === 'loaded') {
      return;
    }

    onPipelineChange({
      frameProcessor: undefined,
      modelLoaded: false,
      modelState: loadState === 'error' ? 'error' : 'loading',
    });
  }, [loadState, onPipelineChange]);

  if (loadState !== 'loaded' || detection.model == null) {
    return null;
  }

  return (
    <LoadedInferenceHost
      model={detection.model}
      enabled={enabled}
      onDetections={onDetections}
      onPipelineChange={onPipelineChange}
    />
  );
}

function LoadedInferenceHost({
  model,
  enabled,
  onDetections,
  onPipelineChange,
}: CameraPipelineHostProps & { model: NonNullable<ReturnType<typeof useTensorflowModel>['model']> }) {
  const frameProcessor = useTfliteFrameProcessor(model, onDetections, enabled);

  useEffect(() => {
    if (frameProcessor == null) {
      return;
    }
    onPipelineChange({
      frameProcessor,
      modelLoaded: true,
      modelState: 'loaded',
    });
  }, [frameProcessor, onPipelineChange]);

  return null;
}

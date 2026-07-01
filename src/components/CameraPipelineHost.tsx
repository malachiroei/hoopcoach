import { useEffect } from 'react';
import type { FrameDetectionPayload } from '@/src/hooks/useTfliteFrameProcessor';
import { MISSING_MODEL_PIPELINE, type CameraPipelineResult } from '@/src/hooks/useCameraPipeline';

interface CameraPipelineHostProps {
  enabled: boolean;
  onDetections: (payload: FrameDetectionPayload) => void;
  onPipelineChange: (pipeline: CameraPipelineResult) => void;
}

/**
 * @deprecated On-device TFLite loading has been replaced by cloud shot detection.
 * Renders nothing and always reports a missing pipeline.
 */
export function CameraPipelineHost({ onPipelineChange }: CameraPipelineHostProps) {
  useEffect(() => {
    onPipelineChange(MISSING_MODEL_PIPELINE);
  }, [onPipelineChange]);

  return null;
}

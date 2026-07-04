import type { CameraPipelineResult } from '@/src/hooks/useCameraPipeline';

/**
 * @deprecated On-device frame-processor camera has been replaced by expo-camera + cloud detection.
 */
export function InferenceCamera() {
  return null;
}

export type { CameraPipelineResult };

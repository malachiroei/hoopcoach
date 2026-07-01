import type { DetectionBox } from '@/src/types';

/**
 * @deprecated Local on-device TFLite inference has been replaced by the
 * Supabase `detect-shot` Edge Function. This stub is kept for API compatibility.
 */
export function useTfliteCameraPipeline(
  _modelAsset: number,
  _onDetections: (detections: DetectionBox[], frameWidth: number, frameHeight: number) => void,
  _enabled = true
) {
  return {
    frameProcessor: undefined,
    modelLoaded: false,
    modelState: 'missing' as const,
  };
}

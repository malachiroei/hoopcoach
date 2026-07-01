import type { Orientation } from 'react-native-vision-camera';
import type { DetectionBox } from '@/src/types';

export interface FrameDetectionPayload {
  detections: DetectionBox[];
  frameWidth: number;
  frameHeight: number;
  orientation: Orientation;
  isMirrored: boolean;
}

/**
 * @deprecated Local on-device TFLite frame processing has been replaced by the
 * Supabase `detect-shot` Edge Function. This stub is kept for type compatibility.
 */
export function useTfliteFrameProcessor(
  _model: unknown,
  _onDetections: (payload: FrameDetectionPayload) => void,
  _enabled = true
) {
  return undefined;
}

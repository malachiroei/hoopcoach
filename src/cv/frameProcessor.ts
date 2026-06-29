/**
 * Frame processor utilities for VisionCamera + TFLite integration.
 *
 * Usage in live session (when Dev Client is built with native modules):
 *
 * ```tsx
 * import { useFrameProcessor, runAtTargetFps } from 'react-native-vision-camera';
 * import { useTensorflowModel } from 'react-native-fast-tflite';
 * import { useResizePlugin } from 'vision-camera-resize-plugin';
 * import { MODEL_INPUT_SIZE } from '@/src/cv/modelConfig';
 *
 * const objectDetection = useTensorflowModel(require('@/src/models/basketball_detector.tflite'));
 * const model = objectDetection.state === 'loaded' ? objectDetection.model : undefined;
 * const { resize } = useResizePlugin();
 *
 * const frameProcessor = useFrameProcessor((frame) => {
 *   'worklet';
 *   if (model == null) return;
 *   runAtTargetFps(8, () => {
 *     'worklet';
 *     const resized = resize(frame, {
 *       scale: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE },
 *       pixelFormat: 'rgb',
 *       dataType: 'uint8',
 *     });
 *     const outputs = model.runSync([resized]);
 *     // Forward outputs to JS via runOnJS
 *   });
 * }, [model]);
 * ```
 */

import type { DetectionBox } from '@/src/types';

export const TARGET_FPS = 8;

export interface FrameProcessorCallbacks {
  onDetections: (detections: DetectionBox[], frameWidth: number, frameHeight: number) => void;
}

export function createFrameResultHandler(callbacks: FrameProcessorCallbacks) {
  return (detections: DetectionBox[], frameWidth: number, frameHeight: number) => {
    callbacks.onDetections(detections, frameWidth, frameHeight);
  };
}

import { useCallback, useMemo } from 'react';
import type { TensorflowModel } from 'react-native-fast-tflite';
import { useFrameProcessor, type Orientation } from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { Worklets, useSharedValue } from 'react-native-worklets-core';
import type { DetectionBox } from '@/src/types';
import { MODEL_INPUT_SIZE, parseYoloOutput } from '@/src/cv/modelConfig';

/** Run TFLite inference on every Nth camera frame to keep the JS thread responsive. */
const INFERENCE_FRAME_SKIP = 3;

export interface FrameDetectionPayload {
  detections: DetectionBox[];
  frameWidth: number;
  frameHeight: number;
  orientation: Orientation;
  isMirrored: boolean;
}

/** Infer layout on the JS thread — do not read frame.orientation inside the worklet. */
function inferFrameLayout(frameWidth: number, frameHeight: number): {
  orientation: Orientation;
  isMirrored: boolean;
} {
  return {
    orientation: frameWidth > frameHeight ? 'landscape-left' : 'portrait',
    isMirrored: false,
  };
}

/**
 * Build a Vision Camera frame processor for an already-loaded TFLite model.
 * Call only after `useTensorflowModel` reports state === 'loaded'.
 */
export function useTfliteFrameProcessor(
  model: TensorflowModel,
  onDetections: (payload: FrameDetectionPayload) => void,
  enabled = true
) {
  const { resize } = useResizePlugin();
  const frameSkipCounter = useSharedValue(0);

  const logProcessorError = useCallback((error: unknown) => {
    console.error('PROCESSOR_RUN_ERROR:', error);
  }, []);

  const handleDetections = useCallback(
    (outputs: unknown, frameWidth: number, frameHeight: number) => {
      try {
        const { orientation, isMirrored } = inferFrameLayout(frameWidth, frameHeight);
        const detections = parseYoloOutput(outputs, frameWidth, frameHeight);
        onDetections({
          detections,
          frameWidth,
          frameHeight,
          orientation,
          isMirrored,
        });
      } catch (error) {
        console.error('PROCESSOR_RUN_ERROR:', error);
      }
    },
    [onDetections]
  );

  const runDetectionsOnJS = useMemo(
    () => Worklets.createRunOnJS(handleDetections),
    [handleDetections]
  );

  const runProcessorErrorOnJS = useMemo(
    () => Worklets.createRunOnJS(logProcessorError),
    [logProcessorError]
  );

  return useFrameProcessor(
    (frame) => {
      'worklet';
      if (!enabled) return;

      frameSkipCounter.value = (frameSkipCounter.value + 1) % INFERENCE_FRAME_SKIP;
      if (frameSkipCounter.value !== 0) {
        return;
      }

      try {
        const resized = resize(frame, {
          scale: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE },
          pixelFormat: 'rgb',
          dataType: 'uint8',
        });

        const inputBuffer = resized.buffer.slice(
          resized.byteOffset,
          resized.byteOffset + resized.byteLength
        );

        const inputArray = new Uint8Array(inputBuffer);
        const outputs = model.runSync([inputArray]);
        runDetectionsOnJS(outputs, frame.width, frame.height);
      } catch (error) {
        runProcessorErrorOnJS(error);
      }
    },
    [model, enabled, runDetectionsOnJS, runProcessorErrorOnJS, resize]
  );
}

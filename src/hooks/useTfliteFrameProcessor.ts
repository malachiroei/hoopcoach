import { useCallback, useMemo } from 'react';
import type { TensorflowModel } from 'react-native-fast-tflite';
import { useFrameProcessor, type Orientation } from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { Worklets, useSharedValue } from 'react-native-worklets-core';
import { parseCocoYoloOutput } from '@/src/cv/cocoModelConfig';
import { MODEL_INPUT_SIZE, parseYoloOutput } from '@/src/cv/modelConfig';
import { ACTIVE_MODEL_KIND_RESOLVED } from '@/src/models/modelSource';
import type { DetectionBox } from '@/src/types';

/** Run TFLite on every Nth frame — keeps UI responsive and cool. */
export const INFERENCE_FRAME_SKIP = 3;

export interface FrameDetectionPayload {
  detections: DetectionBox[];
  frameWidth: number;
  frameHeight: number;
  orientation: Orientation;
  isMirrored: boolean;
}

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
 * Vision Camera frame processor — resize → TFLite → parse on JS thread.
 */
export function useTfliteFrameProcessor(
  model: TensorflowModel | undefined,
  onDetections: (payload: FrameDetectionPayload) => void,
  enabled = true,
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
        const detections =
          ACTIVE_MODEL_KIND_RESOLVED === 'coco'
            ? parseCocoYoloOutput(outputs, frameWidth, frameHeight)
            : parseYoloOutput(outputs, frameWidth, frameHeight);

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
    [onDetections],
  );

  const runDetectionsOnJS = useMemo(
    () => Worklets.createRunOnJS(handleDetections),
    [handleDetections],
  );

  const runProcessorErrorOnJS = useMemo(
    () => Worklets.createRunOnJS(logProcessorError),
    [logProcessorError],
  );

  return useFrameProcessor(
    (frame) => {
      'worklet';
      if (!enabled || !model) {
        return;
      }

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
          resized.byteOffset + resized.byteLength,
        );

        const inputArray = new Uint8Array(inputBuffer);
        const outputs = model.runSync([inputArray]);
        runDetectionsOnJS(outputs, frame.width, frame.height);
      } catch (error) {
        runProcessorErrorOnJS(error);
      }
    },
    [model, enabled, runDetectionsOnJS, runProcessorErrorOnJS, resize],
  );
}

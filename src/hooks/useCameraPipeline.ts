import { useCallback, useMemo } from 'react';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useFrameProcessor, runAtTargetFps } from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { Worklets } from 'react-native-worklets-core';
import type { DetectionBox } from '@/src/types';
import { MODEL_INPUT_SIZE, parseYoloOutput } from '@/src/cv/modelConfig';
import { isMockMode } from '@/src/cv/mockDetector';

/**
 * Hook for real-time TFLite inference via VisionCamera frame processor.
 * Falls back gracefully when model file is not bundled (use mockDetector instead).
 */
export function useCameraPipeline(
  onDetections: (detections: DetectionBox[], frameWidth: number, frameHeight: number) => void,
  enabled = true
) {
  const modelAsset = useMemo(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('@/src/models/basketball_detector.tflite');
    } catch {
      return null;
    }
  }, []);

  const objectDetection = useTensorflowModel(modelAsset);
  const model = objectDetection.state === 'loaded' ? objectDetection.model : undefined;
  const { resize } = useResizePlugin();

  const handleDetections = useCallback(
    (outputs: ArrayBuffer[], frameWidth: number, frameHeight: number) => {
      const detections = parseYoloOutput(outputs, frameWidth, frameHeight);
      onDetections(detections, frameWidth, frameHeight);
    },
    [onDetections]
  );

  const runDetectionsOnJS = Worklets.createRunOnJS(handleDetections);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (!enabled || model == null) return;

      runAtTargetFps(8, () => {
        'worklet';
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
        runDetectionsOnJS(outputs as unknown as ArrayBuffer[], frame.width, frame.height);
      });
    },
    [model, enabled, runDetectionsOnJS]
  );

  return {
    frameProcessor: model && !isMockMode() ? frameProcessor : undefined,
    modelLoaded: objectDetection.state === 'loaded',
    modelState: objectDetection.state,
  };
}

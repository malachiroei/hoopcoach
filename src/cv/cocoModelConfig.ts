import type { DetectionBox, DetectionClass } from '@/src/types';
import { DEFAULT_MODEL_CONFIG, MODEL_INPUT_SIZE, parseYoloOutputWithClasses, toFloat32Array } from '@/src/cv/modelConfig';

/** COCO class index for "sports ball". */
export const COCO_SPORTS_BALL = 32;
/** COCO class index for "person". */
export const COCO_PERSON = 0;

export const COCO_NUM_CLASSES = 80;

export const COCO_MODEL_FILENAME = 'yolov8n_coco.tflite';

export const COCO_CLASS_MAP: { cocoIndex: number; classId: DetectionClass }[] = [
  { cocoIndex: COCO_SPORTS_BALL, classId: 'ball' },
  { cocoIndex: COCO_PERSON, classId: 'player' },
];

export const COCO_MODEL_CONFIG = {
  ...DEFAULT_MODEL_CONFIG,
  numClasses: COCO_NUM_CLASSES,
  confidenceThreshold: 0.28,
  iouThreshold: 0.42,
};

/**
 * Parse a pre-trained YOLOv8 COCO TFLite export.
 * Maps sports ball → ball, person → player (no hoop until custom model is trained).
 */
export function parseCocoYoloOutput(
  outputs: unknown,
  frameWidth: number,
  frameHeight: number,
): DetectionBox[] {
  const data = toFloat32Array(outputs);
  if (!data || data.length === 0 || frameWidth <= 0 || frameHeight <= 0) {
    return [];
  }

  return parseYoloOutputWithClasses(
    data,
    frameWidth,
    frameHeight,
    COCO_MODEL_CONFIG,
    COCO_CLASS_MAP,
  );
}

export function getCocoModelInputSize(): number {
  return MODEL_INPUT_SIZE;
}

import type { DetectionBox } from '@/src/types';

export const DETECTION_CLASSES = ['ball', 'hoop', 'ballInBasket', 'player'] as const;

export const MODEL_INPUT_SIZE = 320;

/** Set after training — see src/models/README.md */
export const MODEL_FILENAME = 'basketball_detector.tflite';

export interface ModelConfig {
  inputSize: number;
  confidenceThreshold: number;
  iouThreshold: number;
  numClasses: number;
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  inputSize: MODEL_INPUT_SIZE,
  confidenceThreshold: 0.5,
  iouThreshold: 0.45,
  numClasses: 4,
};

export function parseYoloOutput(
  outputs: ArrayBuffer[],
  frameWidth: number,
  frameHeight: number,
  config: ModelConfig = DEFAULT_MODEL_CONFIG
): DetectionBox[] {
  if (!outputs[0]) return [];

  const detections: DetectionBox[] = [];
  const output = new Float32Array(outputs[0]);

  const numDetections = Math.min(output.length / 6, 100);

  for (let i = 0; i < numDetections; i++) {
    const offset = i * 6;
    const confidence = output[offset + 4];
    const classId = Math.round(output[offset + 5]);

    if (confidence < config.confidenceThreshold) continue;

    const cx = output[offset] * frameWidth;
    const cy = output[offset + 1] * frameHeight;
    const w = output[offset + 2] * frameWidth;
    const h = output[offset + 3] * frameHeight;

    detections.push({
      x: cx - w / 2,
      y: cy - h / 2,
      width: w,
      height: h,
      confidence,
      classId: DETECTION_CLASSES[classId] ?? 'ball',
    });
  }

  return nonMaxSuppression(detections, config.iouThreshold);
}

function nonMaxSuppression(boxes: DetectionBox[], iouThreshold: number): DetectionBox[] {
  const sorted = [...boxes].sort((a, b) => b.confidence - a.confidence);
  const kept: DetectionBox[] = [];

  for (const box of sorted) {
    const overlaps = kept.some(
      (k) => k.classId === box.classId && computeIoU(k, box) > iouThreshold
    );
    if (!overlaps) kept.push(box);
  }

  return kept;
}

function computeIoU(a: DetectionBox, b: DetectionBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const union = areaA + areaB - intersection;

  return union > 0 ? intersection / union : 0;
}

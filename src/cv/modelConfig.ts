import type { DetectionBox, DetectionClass } from '@/src/types';

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
  confidenceThreshold: 0.35,
  iouThreshold: 0.45,
  numClasses: 4,
};

/** Prefer 9-channel exports (4 box + 4 class + 1 spare) then standard 8-channel YOLOv8. */
function resolveYoloShape(dataLength: number, numClasses: number): { numChannels: number; numAnchors: number } | null {
  const candidates = [numClasses + 5, numClasses + 4];
  for (const numChannels of candidates) {
    if (numChannels > 0 && dataLength % numChannels === 0) {
      return { numChannels, numAnchors: dataLength / numChannels };
    }
  }
  return null;
}

type BoxLayout = 'cxcywh' | 'xyxy';
type TensorMajor = 'channel' | 'anchor';
type CoordSpace = 'pixel' | 'normalized';

interface TensorLayout {
  major: TensorMajor;
  boxLayout: BoxLayout;
  space: CoordSpace;
}

let cachedTensorLayout: TensorLayout | null = null;

function readChannel(
  data: Float32Array,
  channel: number,
  anchorIndex: number,
  numAnchors: number,
  numChannels: number,
  major: TensorMajor
): number {
  if (major === 'channel') {
    return data[channel * numAnchors + anchorIndex];
  }
  return data[anchorIndex * numChannels + channel];
}

function inferBoxLayout(
  data: Float32Array,
  numAnchors: number,
  numChannels: number,
  major: TensorMajor
): { boxLayout: BoxLayout; space: CoordSpace } {
  const sampleSize = Math.min(200, numAnchors);
  let xyxyVotes = 0;
  let normalizedVotes = 0;
  let maxCoord = 0;

  for (let i = 0; i < sampleSize; i++) {
    const v0 = readChannel(data, 0, i, numAnchors, numChannels, major);
    const v1 = readChannel(data, 1, i, numAnchors, numChannels, major);
    const v2 = readChannel(data, 2, i, numAnchors, numChannels, major);
    const v3 = readChannel(data, 3, i, numAnchors, numChannels, major);

    maxCoord = Math.max(maxCoord, Math.abs(v0), Math.abs(v1), Math.abs(v2), Math.abs(v3));

    if (v2 > v0 && v3 > v1) {
      xyxyVotes++;
    }
    if (v0 >= 0 && v0 <= 1.5 && v1 >= 0 && v1 <= 1.5 && v2 >= 0 && v2 <= 1.5 && v3 >= 0 && v3 <= 1.5) {
      normalizedVotes++;
    }
  }

  return {
    space: maxCoord <= 1.5 && normalizedVotes > sampleSize * 0.5 ? 'normalized' : 'pixel',
    boxLayout: xyxyVotes > sampleSize * 0.6 ? 'xyxy' : 'cxcywh',
  };
}

function getTensorLayout(
  data: Float32Array,
  numAnchors: number,
  numChannels: number,
  major: TensorMajor
): TensorLayout {
  const { boxLayout, space } = inferBoxLayout(data, numAnchors, numChannels, major);
  return { major, boxLayout, space };
}

const MIN_BOX_PX = 8;

const CLASS_BOX_LIMITS: Record<
  (typeof DETECTION_CLASSES)[number],
  { maxWidthFrac: number; maxHeightFrac: number; maxAreaFrac: number; minPx: number }
> = {
  ball: { maxWidthFrac: 0.12, maxHeightFrac: 0.12, maxAreaFrac: 0.015, minPx: 8 },
  hoop: { maxWidthFrac: 0.42, maxHeightFrac: 0.32, maxAreaFrac: 0.12, minPx: 14 },
  ballInBasket: { maxWidthFrac: 0.14, maxHeightFrac: 0.14, maxAreaFrac: 0.02, minPx: 6 },
  player: { maxWidthFrac: 0.45, maxHeightFrac: 0.55, maxAreaFrac: 0.18, minPx: 18 },
};

function getScoreChannelLayout(
  numChannels: number,
  numClasses: number
): { hasObjectness: boolean; classChannelStart: number } {
  if (numChannels === numClasses + 5) {
    return { hasObjectness: true, classChannelStart: 5 };
  }
  return { hasObjectness: false, classChannelStart: 4 };
}

function isPlausibleBoxForClass(
  box: { x: number; y: number; width: number; height: number },
  classId: (typeof DETECTION_CLASSES)[number],
  frameWidth: number,
  frameHeight: number
): boolean {
  const limits = CLASS_BOX_LIMITS[classId];
  if (box.width < limits.minPx || box.height < limits.minPx) {
    return false;
  }
  if (box.width > frameWidth * limits.maxWidthFrac || box.height > frameHeight * limits.maxHeightFrac) {
    return false;
  }
  const area = box.width * box.height;
  if (area > frameWidth * frameHeight * limits.maxAreaFrac) {
    return false;
  }
  if (box.x < 0 || box.y < 0) {
    return false;
  }
  if (box.x + box.width > frameWidth + 2 || box.y + box.height > frameHeight + 2) {
    return false;
  }
  if (isEdgeClampArtifact(box, frameWidth, frameHeight)) {
    return false;
  }

  // Tiny boxes in the extreme buffer corner are usually decode noise.
  if (classId === 'ball' && box.x < 20 && box.y < 20 && box.width < 36 && box.height < 36) {
    return false;
  }

  if (classId === 'ball' || classId === 'ballInBasket') {
    const aspect = box.width / Math.max(box.height, 1);
    if (aspect < 0.45 || aspect > 2.2) {
      return false;
    }
  }

  return true;
}

function classScoreLogit(
  data: Float32Array,
  anchorIndex: number,
  classIndex: number,
  numAnchors: number,
  numChannels: number,
  major: TensorMajor,
  scoreLayout: { hasObjectness: boolean; classChannelStart: number }
): number {
  const classLogit = readChannel(
    data,
    scoreLayout.classChannelStart + classIndex,
    anchorIndex,
    numAnchors,
    numChannels,
    major
  );

  if (!scoreLayout.hasObjectness) {
    return classLogit;
  }

  const objectnessLogit = readChannel(data, 4, anchorIndex, numAnchors, numChannels, major);
  return objectnessLogit + classLogit;
}

function boxArea(box: { width: number; height: number }): number {
  return box.width * box.height;
}

/** Reject boxes that hug two frame edges — typical clamp/decode artifacts, not real objects. */
function isEdgeClampArtifact(
  box: { x: number; y: number; width: number; height: number },
  frameWidth: number,
  frameHeight: number
): boolean {
  const margin = 6;
  const touchesRight = box.x + box.width >= frameWidth - margin;
  const touchesBottom = box.y + box.height >= frameHeight - margin;
  const touchesLeft = box.x <= margin;
  const touchesTop = box.y <= margin;
  const edgeCount = [touchesRight, touchesBottom, touchesLeft, touchesTop].filter(Boolean).length;
  return edgeCount >= 2;
}

type BoxCoordSpace = 'normalized' | 'model' | 'frame';

function resolveBoxCoordSpace(
  v0: number,
  v1: number,
  v2: number,
  v3: number,
  frameWidth: number,
  frameHeight: number
): BoxCoordSpace {
  const maxVal = Math.max(v0, v1, v2, v3);
  if (maxVal <= 1.5) {
    return 'normalized';
  }
  if (maxVal > MODEL_INPUT_SIZE * 1.25) {
    const frameMax = Math.max(frameWidth, frameHeight);
    if (maxVal <= frameMax * 1.25) {
      return 'frame';
    }
  }
  return 'model';
}

function scaleBoxX(value: number, space: BoxCoordSpace, frameWidth: number): number {
  if (space === 'normalized') {
    return value * frameWidth;
  }
  if (space === 'frame') {
    return value;
  }
  return value * (frameWidth / MODEL_INPUT_SIZE);
}

function scaleBoxY(value: number, space: BoxCoordSpace, frameHeight: number): number {
  if (space === 'normalized') {
    return value * frameHeight;
  }
  if (space === 'frame') {
    return value;
  }
  return value * (frameHeight / MODEL_INPUT_SIZE);
}

function scaleBoxWidth(value: number, space: BoxCoordSpace, frameWidth: number): number {
  if (space === 'normalized') {
    return value * frameWidth;
  }
  if (space === 'frame') {
    return value;
  }
  return value * (frameWidth / MODEL_INPUT_SIZE);
}

function scaleBoxHeight(value: number, space: BoxCoordSpace, frameHeight: number): number {
  if (space === 'normalized') {
    return value * frameHeight;
  }
  if (space === 'frame') {
    return value;
  }
  return value * (frameHeight / MODEL_INPUT_SIZE);
}

function clampBoxToFrame(
  box: { x: number; y: number; width: number; height: number },
  frameWidth: number,
  frameHeight: number
): { x: number; y: number; width: number; height: number } | null {
  const x = Math.max(0, Math.min(box.x, frameWidth - 1));
  const y = Math.max(0, Math.min(box.y, frameHeight - 1));
  const width = Math.max(0, Math.min(box.width, frameWidth - x));
  const height = Math.max(0, Math.min(box.height, frameHeight - y));

  if (width < MIN_BOX_PX || height < MIN_BOX_PX) {
    return null;
  }

  return { x, y, width, height };
}

/** Ultralytics YOLO exports use center-size boxes in model pixel space (0–320). */
function decodeYolov5ModelBox(
  v0: number,
  v1: number,
  v2: number,
  v3: number,
  frameWidth: number,
  frameHeight: number
): { x: number; y: number; width: number; height: number } | null {
  const space = resolveBoxCoordSpace(v0, v1, v2, v3, frameWidth, frameHeight);
  const cx = scaleBoxX(v0, space, frameWidth);
  const cy = scaleBoxY(v1, space, frameHeight);
  const w = scaleBoxWidth(v2, space, frameWidth);
  const h = scaleBoxHeight(v3, space, frameHeight);
  const box = {
    x: cx - w / 2,
    y: cy - h / 2,
    width: w,
    height: h,
  };

  if (box.width <= 0 || box.height <= 0) {
    return null;
  }

  return clampBoxToFrame(box, frameWidth, frameHeight);
}

function collectYolov5AnchorBoxesForClasses(
  data: Float32Array,
  numAnchors: number,
  numChannels: number,
  numClasses: number,
  frameWidth: number,
  frameHeight: number,
  confidenceThreshold: number,
  classEntries: { classIndex: number; classId: DetectionClass }[],
): DetectionBox[] {
  const major: TensorMajor = 'anchor';
  const scoreLayout = getScoreChannelLayout(numChannels, numClasses);
  const validBoxes: DetectionBox[] = [];

  for (const { classIndex, classId } of classEntries) {
    if (classIndex < 0 || classIndex >= numClasses) {
      continue;
    }

    interface Candidate {
      box: { x: number; y: number; width: number; height: number };
      scoreLogit: number;
    }

    const candidates: Candidate[] = [];

    for (let i = 0; i < numAnchors; i++) {
      const v0 = readChannel(data, 0, i, numAnchors, numChannels, major);
      const v1 = readChannel(data, 1, i, numAnchors, numChannels, major);
      const v2 = readChannel(data, 2, i, numAnchors, numChannels, major);
      const v3 = readChannel(data, 3, i, numAnchors, numChannels, major);

      const box = decodeYolov5ModelBox(v0, v1, v2, v3, frameWidth, frameHeight);
      if (!box || !isPlausibleBoxForClass(box, classId, frameWidth, frameHeight)) {
        continue;
      }

      const scoreLogit = classScoreLogit(
        data,
        i,
        classIndex,
        numAnchors,
        numChannels,
        major,
        scoreLayout,
      );

      candidates.push({ box, scoreLogit });
    }

    if (candidates.length === 0) {
      continue;
    }

    let maxScoreLogit = -Infinity;
    for (const candidate of candidates) {
      maxScoreLogit = Math.max(maxScoreLogit, candidate.scoreLogit);
    }

    const minScoreLogit = maxScoreLogit + Math.log(Math.max(confidenceThreshold, 1e-6));
    const qualifying = candidates
      .filter((candidate) => candidate.scoreLogit >= minScoreLogit)
      .sort((a, b) => {
        if (b.scoreLogit !== a.scoreLogit) {
          return b.scoreLogit - a.scoreLogit;
        }
        return boxArea(a.box) - boxArea(b.box);
      });

    if (qualifying.length === 0) {
      continue;
    }

    const best = qualifying[0];
    const confidence = Math.exp(best.scoreLogit - maxScoreLogit);

    validBoxes.push({
      x: best.box.x,
      y: best.box.y,
      width: best.box.width,
      height: best.box.height,
      confidence,
      classId,
    });
  }

  return validBoxes;
}

function collectYolov5AnchorBoxes(
  data: Float32Array,
  numAnchors: number,
  numChannels: number,
  numClasses: number,
  frameWidth: number,
  frameHeight: number,
  confidenceThreshold: number
): DetectionBox[] {
  const classEntries = DETECTION_CLASSES.map((classId, classIndex) => ({
    classIndex,
    classId,
  }));
  return collectYolov5AnchorBoxesForClasses(
    data,
    numAnchors,
    numChannels,
    numClasses,
    frameWidth,
    frameHeight,
    confidenceThreshold,
    classEntries,
  );
}

function decodeBox(
  v0: number,
  v1: number,
  v2: number,
  v3: number,
  layout: TensorLayout,
  frameWidth: number,
  frameHeight: number
): { x: number; y: number; width: number; height: number } | null {
  const scaleX = frameWidth / MODEL_INPUT_SIZE;
  const scaleY = frameHeight / MODEL_INPUT_SIZE;

  const toModelPx = (value: number) =>
    layout.space === 'normalized' ? value * MODEL_INPUT_SIZE : value;

  if (layout.boxLayout === 'xyxy') {
    const xmin = toModelPx(v0);
    const ymin = toModelPx(v1);
    const xmax = toModelPx(v2);
    const ymax = toModelPx(v3);
    const width = xmax - xmin;
    const height = ymax - ymin;
    if (width <= 0 || height <= 0) {
      return null;
    }
    return {
      x: xmin * scaleX,
      y: ymin * scaleY,
      width: width * scaleX,
      height: height * scaleY,
    };
  }

  const cx = toModelPx(v0);
  const cy = toModelPx(v1);
  const w = toModelPx(v2);
  const h = toModelPx(v3);
  if (w <= 0 || h <= 0) {
    return null;
  }

  return {
    x: (cx - w / 2) * scaleX,
    y: (cy - h / 2) * scaleY,
    width: w * scaleX,
    height: h * scaleY,
  };
}

/**
 * react-native-fast-tflite returns TypedArrays from the worklet bridge as plain
 * objects with numeric string keys — rebuild a real Float32Array for parsing.
 */
export function toFloat32Array(value: unknown): Float32Array | null {
  if (value instanceof Float32Array) {
    return value;
  }

  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return new Float32Array(view.buffer, view.byteOffset, view.byteLength / 4);
  }

  if (value instanceof ArrayBuffer) {
    return new Float32Array(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return null;
    }
    return toFloat32Array(value[0]);
  }

  if (value != null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const numericKeys = Object.keys(record)
      .filter((key) => /^\d+$/.test(key))
      .map(Number)
      .sort((a, b) => a - b);

    if (numericKeys.length > 0) {
      const data = new Float32Array(numericKeys.length);
      for (let i = 0; i < numericKeys.length; i++) {
        data[i] = Number(record[String(numericKeys[i])]);
      }
      return data;
    }
  }

  return null;
}

export function parseYoloOutput(
  outputs: unknown,
  frameWidth: number,
  frameHeight: number,
  config: ModelConfig = DEFAULT_MODEL_CONFIG
): DetectionBox[] {
  const data = toFloat32Array(outputs);
  if (!data || data.length === 0) {
    return [];
  }

  const classEntries = DETECTION_CLASSES.map((classId, classIndex) => ({
    classIndex,
    classId,
  }));
  return parseYoloOutputWithClasses(data, frameWidth, frameHeight, config, classEntries);
}

export function parseYoloOutputWithClasses(
  data: Float32Array,
  frameWidth: number,
  frameHeight: number,
  config: ModelConfig,
  classEntries: { classIndex: number; classId: DetectionClass }[],
): DetectionBox[] {
  const numClasses = config.numClasses;
  const shape = resolveYoloShape(data.length, numClasses);
  if (!shape || shape.numChannels < numClasses + 4) {
    return [];
  }

  const { numChannels, numAnchors } = shape;

  const validBoxes = collectYolov5AnchorBoxesForClasses(
    data,
    numAnchors,
    numChannels,
    numClasses,
    frameWidth,
    frameHeight,
    config.confidenceThreshold,
    classEntries,
  );

  if (validBoxes.length > 0) {
    cachedTensorLayout = getTensorLayout(data, numAnchors, numChannels, 'anchor');
    return nonMaxSuppression(validBoxes, config.iouThreshold);
  }

  return [];
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

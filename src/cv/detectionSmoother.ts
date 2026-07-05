import type { DetectionBox, DetectionClass } from '@/src/types';

const TRACKED_CLASSES: DetectionClass[] = ['ball', 'hoop', 'player'];
const MAX_MISS_MS = 450;
const DEFAULT_ALPHA = 0.38;

interface SmoothState {
  box: DetectionBox;
  updatedAt: number;
}

function boxKey(classId: DetectionClass): string {
  return classId;
}

function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}

function smoothBox(previous: DetectionBox, next: DetectionBox, alpha: number): DetectionBox {
  return {
    ...next,
    x: lerp(previous.x, next.x, alpha),
    y: lerp(previous.y, next.y, alpha),
    width: lerp(previous.width, next.width, alpha),
    height: lerp(previous.height, next.height, alpha),
    confidence: Math.max(previous.confidence, next.confidence),
  };
}

/**
 * Keeps bounding boxes stable between frames — EMA smoothing + short hold on miss.
 */
export class DetectionSmoother {
  private states = new Map<string, SmoothState>();

  reset(): void {
    this.states.clear();
  }

  smooth(detections: DetectionBox[], alpha = DEFAULT_ALPHA, now = Date.now()): DetectionBox[] {
    const incoming = new Map<DetectionClass, DetectionBox>();

    for (const det of detections) {
      if (!TRACKED_CLASSES.includes(det.classId)) {
        continue;
      }
      const existing = incoming.get(det.classId);
      if (!existing || det.confidence > existing.confidence) {
        incoming.set(det.classId, det);
      }
    }

    const output: DetectionBox[] = [];

    for (const classId of TRACKED_CLASSES) {
      const key = boxKey(classId);
      const next = incoming.get(classId);
      const prev = this.states.get(key);

      if (next) {
        const box = prev ? smoothBox(prev.box, next, alpha) : next;
        this.states.set(key, { box, updatedAt: now });
        output.push(box);
        continue;
      }

      if (prev && now - prev.updatedAt <= MAX_MISS_MS) {
        output.push({ ...prev.box, confidence: prev.box.confidence * 0.92 });
      } else {
        this.states.delete(key);
      }
    }

    for (const det of detections) {
      if (det.classId === 'ballInBasket') {
        output.push(det);
      }
    }

    return output;
  }
}

export function pickBestDetection(
  detections: DetectionBox[],
  classId: DetectionClass,
): DetectionBox | null {
  let best: DetectionBox | null = null;
  for (const det of detections) {
    if (det.classId !== classId) {
      continue;
    }
    if (!best || det.confidence > best.confidence) {
      best = det;
    }
  }
  return best;
}

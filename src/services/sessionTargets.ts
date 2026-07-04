import type { CloudNormalizedBox, DetectShotResponse } from '@/src/services/detectShotService';
import type { SessionTargets, TargetAnchor } from '@/src/types';

export const DEFAULT_BALL_ANCHOR: TargetAnchor = { cx: 0.5, cy: 0.65, size: 0.04 };
export const DEFAULT_HOOP_ANCHOR: TargetAnchor = { cx: 0.5, cy: 0.22, size: 0.14 };

export function boxToAnchor(box: CloudNormalizedBox): TargetAnchor {
  return {
    cx: box.x + box.width / 2,
    cy: box.y + box.height / 2,
    size: Math.max(box.width, box.height, 0.03),
  };
}

export function anchorToBox(anchor: TargetAnchor): CloudNormalizedBox {
  const half = anchor.size / 2;
  return {
    x: Math.max(0, anchor.cx - half),
    y: Math.max(0, anchor.cy - half),
    width: anchor.size,
    height: anchor.size,
    confidence: 1,
  };
}

export function buildSessionTargets(
  ball: TargetAnchor,
  hoop: TargetAnchor,
  displayBall: TargetAnchor,
  displayHoop: TargetAnchor,
  frameWidth: number,
  frameHeight: number,
): SessionTargets {
  return { ball, hoop, displayBall, displayHoop, frameWidth, frameHeight };
}

/** Use calibrated hoop for shot counting only — not for on-screen boxes. */
export function applySessionTargetsForShots(
  detection: DetectShotResponse,
  targets: SessionTargets | null,
): DetectShotResponse {
  if (!targets) {
    return detection;
  }

  return {
    ...detection,
    hoopVisible: true,
    hoopBox: anchorToBox(targets.hoop),
  };
}

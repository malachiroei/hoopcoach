import type { CourtCalibration, CourtZone, Point2D } from '@/src/types';

const ZONE_BOUNDARIES: { zone: CourtZone; minX: number; maxX: number; minY: number; maxY: number }[] = [
  { zone: 'paint', minX: 0.35, maxX: 0.65, minY: 0.7, maxY: 1.0 },
  { zone: 'midLeft', minX: 0.0, maxX: 0.35, minY: 0.5, maxY: 0.7 },
  { zone: 'midRight', minX: 0.65, maxX: 1.0, minY: 0.5, maxY: 0.7 },
  { zone: 'midCenter', minX: 0.35, maxX: 0.65, minY: 0.5, maxY: 0.7 },
  { zone: 'threeLeft', minX: 0.0, maxX: 0.3, minY: 0.2, maxY: 0.5 },
  { zone: 'threeRight', minX: 0.7, maxX: 1.0, minY: 0.2, maxY: 0.5 },
  { zone: 'threeCenter', minX: 0.3, maxX: 0.7, minY: 0.0, maxY: 0.3 },
  { zone: 'cornerLeft', minX: 0.0, maxX: 0.15, minY: 0.0, maxY: 0.2 },
  { zone: 'cornerRight', minX: 0.85, maxX: 1.0, minY: 0.0, maxY: 0.2 },
];

export function pixelToNormalized(
  point: Point2D,
  frameWidth: number,
  frameHeight: number
): Point2D {
  return {
    x: point.x / frameWidth,
    y: point.y / frameHeight,
  };
}

export function mapPointToZone(point: Point2D, calibration?: CourtCalibration): CourtZone {
  const normalized = calibration
    ? applyHomography(point, calibration)
    : point;

  for (const boundary of ZONE_BOUNDARIES) {
    if (
      normalized.x >= boundary.minX &&
      normalized.x <= boundary.maxX &&
      normalized.y >= boundary.minY &&
      normalized.y <= boundary.maxY
    ) {
      return boundary.zone;
    }
  }

  return 'midCenter';
}

function applyHomography(point: Point2D, calibration: CourtCalibration): Point2D {
  if (calibration.points.length < 4) return point;

  const [tl, tr, bl, br] = calibration.points;
  const nx = (point.x - tl.x) / (tr.x - tl.x + 0.001);
  const ny = (point.y - tl.y) / (bl.y - tl.y + 0.001);

  const courtX = nx * (br.x - bl.x) + bl.x;
  const courtY = ny;

  return {
    x: Math.max(0, Math.min(1, courtX)),
    y: Math.max(0, Math.min(1, courtY)),
  };
}

export function getZoneCenter(zone: CourtZone): Point2D {
  const boundary = ZONE_BOUNDARIES.find((b) => b.zone === zone);
  if (!boundary) return { x: 0.5, y: 0.5 };

  return {
    x: (boundary.minX + boundary.maxX) / 2,
    y: (boundary.minY + boundary.maxY) / 2,
  };
}

export function isCalibrationComplete(calibration?: CourtCalibration): boolean {
  return (calibration?.points.length ?? 0) >= 4;
}

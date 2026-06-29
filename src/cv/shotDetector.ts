import type { CourtCalibration, DetectionBox, Point2D, ShotEvent } from '@/src/types';
import { BallTracker } from './ballTracker';
import { mapPointToZone, pixelToNormalized } from './courtMapper';

export type ShotDetectorState = 'idle' | 'ballDetected' | 'shotInProgress';

const COOLDOWN_MS = 2000;

export class ShotDetector {
  private tracker = new BallTracker();
  private state: ShotDetectorState = 'idle';
  private lastShotTime = 0;
  private confidenceThreshold = 0.5;
  private frameWidth = 1920;
  private frameHeight = 1080;
  private calibration?: CourtCalibration;
  private onShotDetected?: (event: ShotEvent) => void;

  constructor(confidenceThreshold = 0.5) {
    this.confidenceThreshold = confidenceThreshold;
  }

  setCalibration(calibration?: CourtCalibration): void {
    this.calibration = calibration;
  }

  setFrameSize(width: number, height: number): void {
    this.frameWidth = width;
    this.frameHeight = height;
  }

  setOnShotDetected(callback: (event: ShotEvent) => void): void {
    this.onShotDetected = callback;
  }

  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = threshold;
  }

  processFrame(detections: DetectionBox[], timestamp: number): ShotDetectorState {
    const filtered = detections.filter((d) => d.confidence >= this.confidenceThreshold);
    this.tracker.update(filtered, timestamp);

    const ballInBasket = filtered.some((d) => d.classId === 'ballInBasket');

    switch (this.state) {
      case 'idle':
        if (this.hasBallDetected(filtered)) {
          this.state = 'ballDetected';
        }
        break;

      case 'ballDetected':
        if (this.tracker.isBallMovingUpward() || this.tracker.isBallNearHoop()) {
          this.state = 'shotInProgress';
        }
        break;

      case 'shotInProgress': {
        const made = ballInBasket || this.detectMakeFromTrajectory();
        const missed = this.detectMissFromTrajectory();

        if (made || missed) {
          if (timestamp - this.lastShotTime >= COOLDOWN_MS) {
            this.emitShot(made, timestamp);
            this.lastShotTime = timestamp;
          }
          this.state = 'idle';
          this.tracker.reset();
        }
        break;
      }
    }

    return this.state;
  }

  private hasBallDetected(detections: DetectionBox[]): boolean {
    return detections.some((d) => d.classId === 'ball' || d.classId === 'player');
  }

  private detectMakeFromTrajectory(): boolean {
    const trajectory = this.tracker.getBallTrajectory();
    const hoop = this.tracker.getHoopPosition();
    if (!hoop || trajectory.length < 5) return false;

    const nearHoopPoints = trajectory.filter(
      (p) => Math.hypot(p.x - hoop.x, p.y - hoop.y) < 50
    );

    if (nearHoopPoints.length < 2) return false;

    const descending = trajectory.slice(-3);
    const isDescending = descending.every((p, i) => i === 0 || p.y >= descending[i - 1].y - 5);

    return isDescending && this.tracker.isBallNearHoop(60);
  }

  private detectMissFromTrajectory(): boolean {
    const trajectory = this.tracker.getBallTrajectory();
    if (trajectory.length < 8) return false;

    const velocity = this.tracker.getBallVelocity();
    if (!velocity) return false;

    const wasNearHoop = this.tracker.isBallNearHoop(100);
    const ballFalling = velocity.y > 10;
    const pastHoop = trajectory.length >= 10;

    return wasNearHoop && ballFalling && pastHoop;
  }

  private emitShot(made: boolean, timestamp: number): void {
    const playerPos = this.tracker.getPlayerPosition();
    const ballPos = this.tracker.getBallTrajectory().slice(-1)[0];
    const rawPosition = playerPos ?? ballPos ?? { x: this.frameWidth / 2, y: this.frameHeight * 0.7 };

    const normalized = pixelToNormalized(rawPosition, this.frameWidth, this.frameHeight);
    const zone = mapPointToZone(normalized, this.calibration);

    const event: ShotEvent = {
      made,
      zone,
      position: normalized,
      timestamp,
      confidence: 0.8,
    };

    this.onShotDetected?.(event);
  }

  getTracker(): BallTracker {
    return this.tracker;
  }

  reset(): void {
    this.state = 'idle';
    this.tracker.reset();
    this.lastShotTime = 0;
  }
}

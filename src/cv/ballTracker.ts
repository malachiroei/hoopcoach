import type { DetectionBox, Point2D } from '@/src/types';

const MAX_HISTORY = 30;

interface TrackedObject {
  classId: DetectionBox['classId'];
  positions: Point2D[];
  lastSeen: number;
  confidence: number;
}

export class BallTracker {
  private ballHistory: Point2D[] = [];
  private hoopPosition: Point2D | null = null;
  private playerPosition: Point2D | null = null;
  private lastUpdate = 0;

  update(detections: DetectionBox[], timestamp: number): void {
    this.lastUpdate = timestamp;

    const ball = findBestDetection(detections, 'ball');
    const hoop = findBestDetection(detections, 'hoop');
    const player = findBestDetection(detections, 'player');
    const ballInBasket = findBestDetection(detections, 'ballInBasket');

    if (ball) {
      const center = boxCenter(ball);
      this.ballHistory.push(center);
      if (this.ballHistory.length > MAX_HISTORY) {
        this.ballHistory.shift();
      }
    }

    if (hoop) this.hoopPosition = boxCenter(hoop);
    if (player) this.playerPosition = boxCenter(player);
    if (ballInBasket) {
      this.ballHistory.push(boxCenter(ballInBasket));
    }
  }

  getBallTrajectory(): Point2D[] {
    return [...this.ballHistory];
  }

  getHoopPosition(): Point2D | null {
    return this.hoopPosition;
  }

  getPlayerPosition(): Point2D | null {
    return this.playerPosition;
  }

  getBallVelocity(): Point2D | null {
    if (this.ballHistory.length < 2) return null;

    const recent = this.ballHistory.slice(-3);
    const first = recent[0];
    const last = recent[recent.length - 1];

    return {
      x: last.x - first.x,
      y: last.y - first.y,
    };
  }

  isBallMovingUpward(): boolean {
    const velocity = this.getBallVelocity();
    if (!velocity) return false;
    return velocity.y < -5;
  }

  isBallNearHoop(threshold = 80): boolean {
    if (!this.hoopPosition || this.ballHistory.length === 0) return false;

    const ball = this.ballHistory[this.ballHistory.length - 1];
    const dist = Math.hypot(ball.x - this.hoopPosition.x, ball.y - this.hoopPosition.y);
    return dist < threshold;
  }

  reset(): void {
    this.ballHistory = [];
    this.hoopPosition = null;
    this.playerPosition = null;
  }

  getLastUpdate(): number {
    return this.lastUpdate;
  }
}

function findBestDetection(
  detections: DetectionBox[],
  classId: DetectionBox['classId']
): DetectionBox | null {
  const matches = detections.filter((d) => d.classId === classId);
  if (matches.length === 0) return null;
  return matches.reduce((best, d) => (d.confidence > best.confidence ? d : best));
}

function boxCenter(box: DetectionBox): Point2D {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

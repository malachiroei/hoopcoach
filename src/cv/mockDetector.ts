import type { DetectionBox } from '@/src/types';
import { ENABLE_MOCK_DETECTION } from '@/src/models/modelSource';

const ZONES_FOR_MOCK = [
  'paint',
  'midLeft',
  'midRight',
  'threeLeft',
  'threeRight',
  'threeCenter',
] as const;

let mockInterval: ReturnType<typeof setInterval> | null = null;
let shotCounter = 0;

export function startMockDetection(
  onDetections: (detections: DetectionBox[]) => void,
  onShot: (made: boolean) => void,
  intervalMs = 8000
): void {
  stopMockDetection();
  shotCounter = 0;

  mockInterval = setInterval(() => {
    shotCounter += 1;
    const made = Math.random() > 0.4;
    const detections = generateMockFrame(made);
    onDetections(detections);

    setTimeout(() => {
      onShot(made);
    }, 1500);
  }, intervalMs);
}

export function stopMockDetection(): void {
  if (mockInterval) {
    clearInterval(mockInterval);
    mockInterval = null;
  }
}

function generateMockFrame(made: boolean): DetectionBox[] {
  const hoopX = 160 + Math.random() * 20;
  const hoopY = 80 + Math.random() * 10;
  const playerX = 100 + Math.random() * 120;
  const playerY = 250 + Math.random() * 30;

  const detections: DetectionBox[] = [
    {
      x: hoopX,
      y: hoopY,
      width: 60,
      height: 40,
      confidence: 0.92,
      classId: 'hoop',
    },
    {
      x: playerX,
      y: playerY,
      width: 50,
      height: 100,
      confidence: 0.85,
      classId: 'player',
    },
    {
      x: playerX + 20,
      y: playerY - 30,
      width: 20,
      height: 20,
      confidence: 0.78,
      classId: 'ball',
    },
  ];

  if (made) {
    detections.push({
      x: hoopX + 15,
      y: hoopY + 10,
      width: 18,
      height: 18,
      confidence: 0.88,
      classId: 'ballInBasket',
    });
  }

  return detections;
}

export function isMockMode(): boolean {
  return ENABLE_MOCK_DETECTION;
}

export function getRandomMockZone(): (typeof ZONES_FOR_MOCK)[number] {
  return ZONES_FOR_MOCK[Math.floor(Math.random() * ZONES_FOR_MOCK.length)];
}

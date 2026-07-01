import type { CourtCalibration, DetectionBox, ShotEvent } from '@/src/types';
import { ShotDetector } from './shotDetector';
import { parseYoloOutput, DEFAULT_MODEL_CONFIG } from './modelConfig';

export interface DetectionPipelineOptions {
  confidenceThreshold?: number;
  calibration?: CourtCalibration;
  onShot: (event: ShotEvent) => void;
  onDetections?: (detections: DetectionBox[]) => void;
  onStateChange?: (state: string) => void;
}

export class DetectionPipeline {
  private shotDetector: ShotDetector;
  private frameWidth = 1920;
  private frameHeight = 1080;

  constructor(options: DetectionPipelineOptions) {
    this.shotDetector = new ShotDetector(options.confidenceThreshold ?? 0.5);
    this.shotDetector.setCalibration(options.calibration);
    this.shotDetector.setOnShotDetected(options.onShot);

    this.onDetections = options.onDetections;
    this.onStateChange = options.onStateChange;
  }

  private onDetections?: (detections: DetectionBox[]) => void;
  private onStateChange?: (state: string) => void;

  setCalibration(calibration?: CourtCalibration): void {
    this.shotDetector.setCalibration(calibration);
  }

  setFrameSize(width: number, height: number): void {
    this.frameWidth = width;
    this.frameHeight = height;
    this.shotDetector.setFrameSize(width, height);
  }

  processDetections(detections: DetectionBox[]): void {
    const timestamp = Date.now();
    this.onDetections?.(detections);
    const state = this.shotDetector.processFrame(detections, timestamp);
    this.onStateChange?.(state);
  }

  processModelOutput(outputs: unknown): void {
    const detections = parseYoloOutput(outputs, this.frameWidth, this.frameHeight, DEFAULT_MODEL_CONFIG);
    this.processDetections(detections);
  }

  reset(): void {
    this.shotDetector.reset();
  }

  getShotDetector(): ShotDetector {
    return this.shotDetector;
  }
}

export function createDetectionPipeline(options: DetectionPipelineOptions): DetectionPipeline {
  return new DetectionPipeline(options);
}

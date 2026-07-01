import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import type { CourtCalibration, DetectionBox, ShotEvent } from '@/src/types';
import { createDetectionPipeline, DetectionPipeline } from '@/src/cv/detectionPipeline';
import { startMockDetection, stopMockDetection, getRandomMockZone } from '@/src/cv/mockDetector';
import { recordShotEvent } from '@/src/services/sessionService';
import { statsService } from '@/src/services/statsService';

function detectionsChanged(previous: DetectionBox[], next: DetectionBox[]): boolean {
  if (previous.length !== next.length) {
    return true;
  }

  for (let i = 0; i < next.length; i++) {
    const a = previous[i];
    const b = next[i];
    if (
      a.classId !== b.classId ||
      Math.abs(a.x - b.x) > 2 ||
      Math.abs(a.y - b.y) > 2 ||
      Math.abs(a.width - b.width) > 2 ||
      Math.abs(a.height - b.height) > 2 ||
      Math.abs(a.confidence - b.confidence) > 0.05
    ) {
      return true;
    }
  }

  return false;
}

interface UseLiveSessionOptions {
  calibration?: CourtCalibration;
  confidenceThreshold?: number;
  useMock?: boolean;
}

export function useLiveSession(options: UseLiveSessionOptions = {}) {
  const { calibration, confidenceThreshold = 0.5, useMock = false } = options;
  const pipelineRef = useRef<DetectionPipeline | null>(null);
  const [detections, setDetections] = useState<DetectionBox[]>([]);
  const [detectorState, setDetectorState] = useState('idle');
  const [showSwish, setShowSwish] = useState(false);
  const [stats, setStats] = useState(statsService.getStats());

  const handleShot = useCallback(async (event: ShotEvent) => {
    const shot = await recordShotEvent(event);
    if (!shot) return;

    const newStats = statsService.addShot(shot);
    setStats(newStats);

    if (event.made) {
      setShowSwish(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleDetectionsUpdate = useCallback((nextDetections: DetectionBox[]) => {
    setDetections((previous) => {
      if (nextDetections.length === 0 && previous.length === 0) {
        return previous;
      }
      return detectionsChanged(previous, nextDetections) ? nextDetections : previous;
    });
  }, []);

  useEffect(() => {
    statsService.reset();

    pipelineRef.current = createDetectionPipeline({
      calibration,
      confidenceThreshold,
      onShot: handleShot,
      onDetections: handleDetectionsUpdate,
      onStateChange: setDetectorState,
    });

    if (useMock) {
      startMockDetection(
        (mockDetections) => {
          pipelineRef.current?.processDetections(mockDetections);
        },
        (made) => {
          const event: ShotEvent = {
            made,
            zone: getRandomMockZone(),
            position: { x: Math.random(), y: Math.random() },
            timestamp: Date.now(),
            confidence: 0.85,
          };
          handleShot(event);
        },
        10000
      );
    }

    return () => {
      stopMockDetection();
      pipelineRef.current?.reset();
    };
  }, [calibration, confidenceThreshold, handleDetectionsUpdate, handleShot, useMock]);

  const processDetections = useCallback(
    (dets: DetectionBox[], frameWidth: number, frameHeight: number) => {
      pipelineRef.current?.setFrameSize(frameWidth, frameHeight);
      pipelineRef.current?.processDetections(dets);
    },
    []
  );

  return {
    detections,
    detectorState,
    stats,
    showSwish,
    setShowSwish,
    processDetections,
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import type { CourtCalibration, DetectionBox, ShotEvent } from '@/src/types';
import { createDetectionPipeline, DetectionPipeline } from '@/src/cv/detectionPipeline';
import { startMockDetection, stopMockDetection, getRandomMockZone } from '@/src/cv/mockDetector';
import { recordShotEvent } from '@/src/services/sessionService';
import { statsService } from '@/src/services/statsService';

interface UseLiveSessionOptions {
  calibration?: CourtCalibration;
  confidenceThreshold?: number;
  useMock?: boolean;
}

export function useLiveSession(options: UseLiveSessionOptions = {}) {
  const { calibration, confidenceThreshold = 0.5, useMock = true } = options;
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

  useEffect(() => {
    statsService.reset();

    pipelineRef.current = createDetectionPipeline({
      calibration,
      confidenceThreshold,
      onShot: handleShot,
      onDetections: setDetections,
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
  }, [calibration, confidenceThreshold, handleShot, useMock]);

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

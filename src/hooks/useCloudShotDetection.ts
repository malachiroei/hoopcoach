import { useEffect, useRef } from 'react';
import type { CameraView } from 'expo-camera';
import {
  invokeDetectShot,
  type DetectShotMode,
  type DetectShotResponse,
} from '@/src/services/detectShotService';
import {
  getBurstDelayMs,
  pushCloudShotHistory,
  resolveCountedShotEvent,
  shouldCountCloudShot,
  shouldEnterShotWatch,
  shouldUseOutcomeMode,
  toHistoryEntry,
  type CloudShotHistoryEntry,
} from '@/src/services/cloudShotTracker';

const SHOT_COOLDOWN_MS = 1200;
const FRAME_BUFFER_SIZE = 3;
const WATCH_DURATION_MS = 12_000;
const DEFAULT_INTERVAL_MS = 250;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface UseCloudShotDetectionOptions {
  cameraRef: React.RefObject<CameraView | null>;
  enabled: boolean;
  confidenceThreshold?: number;
  intervalMs?: number;
  /** Use calibrate mode for sharper ball/hoop boxes during setup preview. */
  detectMode?: DetectShotMode;
  onDetection: (
    result: DetectShotResponse,
    frame?: { width: number; height: number },
  ) => void;
  onShot: (result: DetectShotResponse) => void;
  onError?: (message: string) => void;
}

export function useCloudShotDetection({
  cameraRef,
  enabled,
  confidenceThreshold = 0.5,
  intervalMs = DEFAULT_INTERVAL_MS,
  detectMode = 'track',
  onDetection,
  onShot,
  onError,
}: UseCloudShotDetectionOptions) {
  const frameBufferRef = useRef<string[]>([]);
  const lastShotAtRef = useRef(0);
  const prevErrorRef = useRef<string | null>(null);
  const lastErrorAtRef = useRef(0);
  const historyRef = useRef<CloudShotHistoryEntry[]>([]);
  const watchUntilRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      frameBufferRef.current = [];
      historyRef.current = [];
      watchUntilRef.current = 0;
      return;
    }

    let cancelled = false;

    const captureAndDetect = async (): Promise<void> => {
      const camera = cameraRef.current;
      if (!camera || cancelled) {
        return;
      }

      try {
        const photo = await camera.takePictureAsync({
          base64: true,
          quality: detectMode === 'calibrate' ? 0.82 : 0.55,
          shutterSound: false,
          skipProcessing: true,
        });

        if (!photo?.base64) {
          throw new Error('Camera snapshot returned no base64 data');
        }

        const buffer = frameBufferRef.current;
        const prevImageBase64 = buffer[buffer.length - 1];
        const prevImage2Base64 = buffer[buffer.length - 2];
        const watchActive = Date.now() < watchUntilRef.current;
        const mode: DetectShotMode =
          detectMode === 'calibrate' ? 'calibrate' : watchActive ? 'outcome' : 'track';

        const result = await invokeDetectShot({
          imageBase64: photo.base64,
          prevImageBase64,
          prevImage2Base64,
          mode,
          screenMode: true,
        });

        if (cancelled) {
          return;
        }

        frameBufferRef.current = [...buffer, photo.base64].slice(-FRAME_BUFFER_SIZE);

        if (shouldEnterShotWatch(result)) {
          watchUntilRef.current = Date.now() + WATCH_DURATION_MS;
        } else if (!result.hoopVisible) {
          watchUntilRef.current = 0;
        }

        onDetection(result, {
          width: photo.width ?? 0,
          height: photo.height ?? 0,
        });

        const historyEntry = toHistoryEntry(result);
        historyRef.current = pushCloudShotHistory(historyRef.current, historyEntry);

        if (shouldCountCloudShot(result, historyRef.current, confidenceThreshold)) {
          const now = Date.now();
          if (now - lastShotAtRef.current >= SHOT_COOLDOWN_MS) {
            lastShotAtRef.current = now;
            const countedResult = resolveCountedShotEvent(result, historyRef.current);
            onShot(countedResult);
          }
        }

        if (shouldUseOutcomeMode(result, Date.now() < watchUntilRef.current)) {
          watchUntilRef.current = Date.now() + WATCH_DURATION_MS;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Cloud detection failed';
        if (
          message.includes('Failed to capture image') ||
          message.includes('not ready') ||
          message.includes('recording')
        ) {
          return;
        }

        if (message !== prevErrorRef.current) {
          prevErrorRef.current = message;
          console.warn('CLOUD_DETECT_ERROR:', message);
        }

        const now = Date.now();
        if (now - lastErrorAtRef.current >= 8000) {
          lastErrorAtRef.current = now;
          onError?.(message);
        }
      }
    };

    const runContinuousDetection = async () => {
      while (!cancelled) {
        const cycleStart = Date.now();
        const watchActive = Date.now() < watchUntilRef.current;
        await captureAndDetect();
        if (cancelled) {
          return;
        }

        const burstDelay = getBurstDelayMs(watchActive);
        const elapsed = Date.now() - cycleStart;
        const waitMs = Math.max(burstDelay, intervalMs - elapsed);
        if (waitMs > 0) {
          await delay(waitMs);
        }
      }
    };

    void runContinuousDetection();

    return () => {
      cancelled = true;
      frameBufferRef.current = [];
      historyRef.current = [];
      watchUntilRef.current = 0;
    };
  }, [
    cameraRef,
    confidenceThreshold,
    enabled,
    intervalMs,
    detectMode,
    onDetection,
    onShot,
    onError,
  ]);
}

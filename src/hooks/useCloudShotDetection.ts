import { useEffect, useRef } from 'react';
import * as FileSystem from 'expo-file-system';
import type { Camera } from 'react-native-vision-camera';
import {
  invokeDetectShot,
  type DetectShotResponse,
} from '@/src/services/detectShotService';

const DEFAULT_INTERVAL_MS = 1500;
const SHOT_COOLDOWN_MS = 2500;

interface UseCloudShotDetectionOptions {
  cameraRef: React.RefObject<Camera | null>;
  enabled: boolean;
  confidenceThreshold?: number;
  intervalMs?: number;
  onDetection: (result: DetectShotResponse) => void;
  onShot: (result: DetectShotResponse) => void;
  onError?: (message: string) => void;
}

export function useCloudShotDetection({
  cameraRef,
  enabled,
  confidenceThreshold = 0.5,
  intervalMs = DEFAULT_INTERVAL_MS,
  onDetection,
  onShot,
  onError,
}: UseCloudShotDetectionOptions) {
  const prevImageRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const lastShotAtRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      prevImageRef.current = null;
      return;
    }

    let cancelled = false;

    const captureAndDetect = async () => {
      if (cancelled || inFlightRef.current) {
        return;
      }

      const camera = cameraRef.current;
      if (!camera) {
        return;
      }

      inFlightRef.current = true;

      try {
        const photo = await camera.takePhoto({
          enableShutterSound: false,
          flash: 'off',
        });

        const imageBase64 = await FileSystem.readAsStringAsync(photo.path, {
          encoding: FileSystem.EncodingType.Base64,
        });

        await FileSystem.deleteAsync(photo.path, { idempotent: true }).catch(() => undefined);

        const result = await invokeDetectShot({
          imageBase64,
          prevImageBase64: prevImageRef.current ?? undefined,
        });

        if (cancelled) {
          return;
        }

        prevImageRef.current = imageBase64;
        onDetection(result);

        if (
          result.event !== 'no_shot' &&
          result.confidence >= confidenceThreshold
        ) {
          const now = Date.now();
          if (now - lastShotAtRef.current >= SHOT_COOLDOWN_MS) {
            lastShotAtRef.current = now;
            onShot(result);
          }
        }
      } catch (error) {
        console.error('CLOUD_DETECT_ERROR:', error);
        const message = error instanceof Error ? error.message : 'Cloud detection failed';
        onError?.(message);
      } finally {
        inFlightRef.current = false;
      }
    };

    void captureAndDetect();
    const timer = setInterval(() => {
      void captureAndDetect();
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
      prevImageRef.current = null;
    };
  }, [
    cameraRef,
    confidenceThreshold,
    enabled,
    intervalMs,
    onDetection,
    onShot,
    onError,
  ]);
}

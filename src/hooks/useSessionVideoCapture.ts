import { useCallback, useEffect, useRef } from 'react';
import type { CameraView } from 'expo-camera';
import { stopHighlightRecording } from '@/src/services/highlightService';

const SEGMENT_MAX_SECONDS = 90;
const MIN_CLIP_MS = 1500;

interface UseSessionVideoCaptureOptions {
  cameraRef: React.RefObject<CameraView | null>;
  sessionId: string | null;
  enabled: boolean;
}

export function useSessionVideoCapture({
  cameraRef,
  sessionId,
  enabled,
}: UseSessionVideoCaptureOptions) {
  const recordingPromiseRef = useRef<Promise<{ uri: string } | undefined> | null>(null);
  const isRecordingRef = useRef(false);
  const segmentStartedAtRef = useRef(0);

  const startSegment = useCallback(async () => {
    if (!enabled || !sessionId || isRecordingRef.current) {
      return;
    }

    const camera = cameraRef.current;
    if (!camera) {
      return;
    }

    try {
      isRecordingRef.current = true;
      segmentStartedAtRef.current = Date.now();
      recordingPromiseRef.current = camera.recordAsync({
        maxDuration: SEGMENT_MAX_SECONDS,
      });
    } catch (error) {
      isRecordingRef.current = false;
      recordingPromiseRef.current = null;
      console.warn('Highlight recording start failed:', error);
    }
  }, [cameraRef, enabled, sessionId]);

  const finalizeHighlightSegment = useCallback(async (): Promise<string | null> => {
    if (!isRecordingRef.current || !recordingPromiseRef.current) {
      return null;
    }

    const elapsed = Date.now() - segmentStartedAtRef.current;
    if (elapsed < MIN_CLIP_MS) {
      return null;
    }

    const camera = cameraRef.current;
    if (!camera) {
      return null;
    }

    try {
      camera.stopRecording();
      const recording = await recordingPromiseRef.current;
      return recording?.uri ?? null;
    } catch (error) {
      console.warn('Highlight recording finalize failed:', error);
      return null;
    } finally {
      isRecordingRef.current = false;
      recordingPromiseRef.current = null;
    }
  }, [cameraRef]);

  useEffect(() => {
    if (!enabled || !sessionId) {
      return;
    }

    const timer = setTimeout(() => {
      void startSegment();
    }, 800);

    return () => {
      clearTimeout(timer);
      void stopHighlightRecording(cameraRef, recordingPromiseRef, isRecordingRef);
    };
  }, [cameraRef, enabled, sessionId, startSegment]);

  return {
    finalizeHighlightSegment,
    startSegment,
  };
}

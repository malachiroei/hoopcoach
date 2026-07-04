import { useCallback, useRef } from 'react';
import type { CameraView } from 'expo-camera';

const MODE_SWITCH_MS = 400;
const MIN_CLIP_MS = 1200;
const MAX_CLIP_MS = 7000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface UseOnDemandHighlightCaptureOptions {
  cameraRef: React.RefObject<CameraView | null>;
  onRecordingStateChange: (recording: boolean) => void;
}

/**
 * Records from shot attempt through outcome so highlights capture the actual make.
 * Clip is saved only when finalizeMadeCapture() is called after shot_made.
 */
export function useOnDemandHighlightCapture({
  cameraRef,
  onRecordingStateChange,
}: UseOnDemandHighlightCaptureOptions) {
  const recordingPromiseRef = useRef<Promise<{ uri: string } | undefined> | null>(null);
  const isRecordingRef = useRef(false);
  const isStartingRef = useRef(false);
  const startedAtRef = useRef(0);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearMaxDurationTimer = useCallback(() => {
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
  }, []);

  const setRecordingState = useCallback(
    (recording: boolean) => {
      isRecordingRef.current = recording;
      onRecordingStateChange(recording);
    },
    [onRecordingStateChange]
  );

  const stopRecordingInternal = useCallback(async (): Promise<string | null> => {
    clearMaxDurationTimer();

    if (!recordingPromiseRef.current) {
      setRecordingState(false);
      return null;
    }

    try {
      cameraRef.current?.stopRecording();
      const recording = await recordingPromiseRef.current;
      return recording?.uri ?? null;
    } catch (error) {
      console.warn('Highlight stopRecording failed:', error);
      return null;
    } finally {
      recordingPromiseRef.current = null;
      isStartingRef.current = false;
      setRecordingState(false);
    }
  }, [cameraRef, clearMaxDurationTimer, setRecordingState]);

  const cancelAttemptCapture = useCallback(async () => {
    if (!recordingPromiseRef.current && !isRecordingRef.current && !isStartingRef.current) {
      return;
    }

    clearMaxDurationTimer();

    try {
      if (recordingPromiseRef.current) {
        cameraRef.current?.stopRecording();
        await recordingPromiseRef.current;
      }
    } catch {
      // discard failed recordings
    } finally {
      recordingPromiseRef.current = null;
      isStartingRef.current = false;
      setRecordingState(false);
    }
  }, [cameraRef, clearMaxDurationTimer, setRecordingState]);

  const tryStartAttemptCapture = useCallback(async (): Promise<boolean> => {
    if (isRecordingRef.current || isStartingRef.current || recordingPromiseRef.current) {
      return false;
    }

    isStartingRef.current = true;
    setRecordingState(true);

    try {
      await delay(MODE_SWITCH_MS);

      const camera = cameraRef.current;
      if (!camera) {
        return false;
      }

      recordingPromiseRef.current = camera.recordAsync({ maxDuration: 8 });
      startedAtRef.current = Date.now();

      maxDurationTimerRef.current = setTimeout(() => {
        void cancelAttemptCapture();
      }, MAX_CLIP_MS);

      return true;
    } catch (error) {
      console.warn('Highlight attempt capture failed:', error);
      await cancelAttemptCapture();
      return false;
    } finally {
      isStartingRef.current = false;
    }
  }, [cameraRef, cancelAttemptCapture, setRecordingState]);

  const finalizeMadeCapture = useCallback(async (): Promise<string | null> => {
    if (!recordingPromiseRef.current && !isRecordingRef.current) {
      return null;
    }

    const elapsed = Date.now() - startedAtRef.current;
    if (elapsed > 0 && elapsed < MIN_CLIP_MS) {
      await delay(MIN_CLIP_MS - elapsed);
    }

    return stopRecordingInternal();
  }, [stopRecordingInternal]);

  const salvageAttemptClip = useCallback(async (): Promise<string | null> => {
    if (!recordingPromiseRef.current && !isRecordingRef.current) {
      return null;
    }

    const elapsed = Date.now() - startedAtRef.current;
    if (elapsed < MIN_CLIP_MS) {
      await cancelAttemptCapture();
      return null;
    }

    return stopRecordingInternal();
  }, [cancelAttemptCapture, stopRecordingInternal]);

  return {
    tryStartAttemptCapture,
    finalizeMadeCapture,
    cancelAttemptCapture,
    salvageAttemptClip,
  };
}

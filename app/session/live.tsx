import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCameraPermissions, useMicrophonePermissions, type CameraView } from 'expo-camera';
import { Button } from '@/src/components/Button';
import { PreviewCamera } from '@/src/components/PreviewCamera';
import { DetectionOverlay } from '@/src/components/DetectionOverlay';
import { TargetCalibrationView } from '@/src/components/TargetCalibrationView';
import { SwishEffect } from '@/src/components/SwishEffect';
import { useLiveSession } from '@/src/hooks/useLiveSession';
import { useCloudShotDetection } from '@/src/hooks/useCloudShotDetection';
import { isSupabaseConfigured } from '@/src/lib/supabase';
import type { DetectShotResponse } from '@/src/services/detectShotService';
import { invokeDetectShot } from '@/src/services/detectShotService';
import { startSession, endSession, getSessionDuration } from '@/src/services/sessionService';
import { initHighlightBuffer, clearHighlightBuffer, saveManualHighlight } from '@/src/services/highlightService';
import { useOnDemandHighlightCapture } from '@/src/hooks/useOnDemandHighlightCapture';
import { getUserProfile } from '@/src/services/database';
import {
  applySessionTargetsForShots,
  boxToAnchor,
  buildSessionTargets,
  DEFAULT_BALL_ANCHOR,
  DEFAULT_HOOP_ANCHOR,
} from '@/src/services/sessionTargets';
import {
  filterCloudDetection,
  smoothCloudDetection,
  toFriendlyDetectError,
} from '@/src/services/cloudDetectionFilter';
import type { SessionTargets, TargetAnchor } from '@/src/types';
import { colors, spacing, typography } from '@/src/theme';

const CLOUD_DETECT_INTERVAL_MS = 250;

type SessionPhase = 'preview' | 'scanning' | 'confirm' | 'running';

interface CalibrationSnapshot {
  uri: string;
  ball: TargetAnchor;
  hoop: TargetAnchor;
}

function normalizeFrameSize(
  frame: { width: number; height: number },
  displayWidth: number,
  displayHeight: number,
): { width: number; height: number } {
  if (frame.width <= 0 || frame.height <= 0) {
    return frame;
  }

  const frameLandscape = frame.width > frame.height;
  const displayLandscape = displayWidth > displayHeight;

  if (frameLandscape !== displayLandscape) {
    return { width: frame.height, height: frame.width };
  }

  return frame;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function LiveSessionScreen() {
  const { t } = useTranslation();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const hasPermission = permission?.granted ?? false;
  const isFocused = useIsFocused();
  const cameraRef = useRef<CameraView>(null);

  const [debugMode, setDebugMode] = useState(__DEV__);
  const [useMock, setUseMock] = useState(false);
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('preview');
  const [sessionTargets, setSessionTargets] = useState<SessionTargets | null>(null);
  const [calibrationSnapshot, setCalibrationSnapshot] = useState<CalibrationSnapshot | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [cloudDetection, setCloudDetection] = useState<DetectShotResponse | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [cloudDetectError, setCloudDetectError] = useState<string | null>(null);
  const cloudDetectionRef = useRef<DetectShotResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [highlightRecording, setHighlightRecording] = useState(false);

  const supabaseReady = isSupabaseConfigured();
  const cameraActive = sessionPhase !== 'confirm';
  const isRunning = sessionPhase === 'running';
  const cameraSessionActive = isFocused && cameraActive && !isEnding;
  const cloudDetectionActive =
    supabaseReady && !useMock && isRunning && cameraSessionActive && !showEndConfirm;
  const highlightCaptureActive = cloudDetectionActive;
  const cloudDetectionEnabled = cloudDetectionActive && !highlightRecording;
  const calibrationPhotoMode = sessionPhase === 'preview' || sessionPhase === 'scanning';

  const { stats, showSwish, setShowSwish, processCloudShot } = useLiveSession({
    confidenceThreshold,
    useMock,
  });

  const {
    tryStartAttemptCapture,
    finalizeMadeCapture,
    cancelAttemptCapture,
    salvageAttemptClip,
  } = useOnDemandHighlightCapture({
    cameraRef,
    onRecordingStateChange: setHighlightRecording,
  });

  const handleCloudDetection = useCallback(
    (result: DetectShotResponse, frame?: { width: number; height: number }) => {
      if (isEnding || showEndConfirm) {
        return;
      }

      setCloudDetectError(null);

      if (frame && frame.width > 0 && frame.height > 0) {
        setFrameSize(normalizeFrameSize(frame, screenWidth, screenHeight));
      }

      const filtered = filterCloudDetection(result);
      const smoothed = smoothCloudDetection(cloudDetectionRef.current, filtered);
      cloudDetectionRef.current = smoothed;
      setCloudDetection(smoothed);

      if (!highlightCaptureActive) {
        return;
      }

      if (
        smoothed.shotPhase === 'attempt' ||
        smoothed.shotActive ||
        (smoothed.ballVisible && smoothed.hoopVisible && smoothed.shotPhase === 'outcome')
      ) {
        void tryStartAttemptCapture();
      }
    },
    [
      highlightCaptureActive,
      isEnding,
      screenHeight,
      screenWidth,
      showEndConfirm,
      tryStartAttemptCapture,
    ]
  );

  const handleCloudDetectError = useCallback((message: string) => {
    const friendly = toFriendlyDetectError(message);
    if (friendly) {
      setCloudDetectError(friendly);
    }
  }, []);

  const handleCloudShot = useCallback(
    async (result: DetectShotResponse) => {
      if (isEnding || showEndConfirm) {
        return;
      }

      if (result.event === 'shot_missed') {
        const clipUri = await salvageAttemptClip();
        if (clipUri && sessionId) {
          await saveManualHighlight(sessionId, clipUri);
        } else {
          await cancelAttemptCapture();
        }
        await processCloudShot(applySessionTargetsForShots(result, sessionTargets));
        return;
      }

      let videoUri: string | null = null;
      if (result.event === 'shot_made' && highlightCaptureActive) {
        if (!highlightRecording) {
          await tryStartAttemptCapture();
        }
        videoUri = await finalizeMadeCapture();
        if (!videoUri) {
          videoUri = await salvageAttemptClip();
        }
      }

      await processCloudShot(applySessionTargetsForShots(result, sessionTargets), videoUri ?? undefined);
    },
    [
      cancelAttemptCapture,
      finalizeMadeCapture,
      highlightCaptureActive,
      highlightRecording,
      isEnding,
      processCloudShot,
      salvageAttemptClip,
      sessionId,
      sessionTargets,
      showEndConfirm,
      tryStartAttemptCapture,
    ]
  );

  useCloudShotDetection({
    cameraRef,
    enabled: cloudDetectionEnabled,
    confidenceThreshold,
    intervalMs: CLOUD_DETECT_INTERVAL_MS,
    onDetection: handleCloudDetection,
    onShot: handleCloudShot,
    onError: handleCloudDetectError,
  });

  useEffect(() => {
    if (!cloudDetectError) {
      return;
    }
    const timer = setTimeout(() => setCloudDetectError(null), 4000);
    return () => clearTimeout(timer);
  }, [cloudDetectError]);

  useEffect(() => {
    async function lockLandscape() {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch (error) {
        console.warn('ORIENTATION_LOCK_ERROR:', error);
      }
    }

    void lockLandscape();

    return () => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(
        () => undefined,
      );
    };
  }, []);

  useEffect(() => {
    if (!permission?.granted) {
      void requestPermission();
    }
  }, [permission?.granted, requestPermission]);

  useEffect(() => {
    if (highlightCaptureActive && !micPermission?.granted) {
      void requestMicPermission();
    }
  }, [highlightCaptureActive, micPermission?.granted, requestMicPermission]);

  useEffect(() => {
    getUserProfile().then((profile) => {
      setConfidenceThreshold(profile.confidenceThreshold);
    });
  }, []);

  useEffect(() => {
    if (!sessionStarted || sessionPhase !== 'running') {
      return;
    }

    let active = true;
    startSession().then((session) => {
      if (active) {
        setSessionId(session.id);
        initHighlightBuffer(session.id);
      }
    });

    const timer = setInterval(() => {
      setElapsed(getSessionDuration());
    }, 1000);

    return () => {
      active = false;
      clearInterval(timer);
      clearHighlightBuffer();
    };
  }, [sessionPhase, sessionStarted]);

  const runCalibrationScan = useCallback(async () => {
    if (!cameraRef.current) {
      return;
    }

    setSessionPhase('scanning');
    setCloudDetectError(null);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.85,
        shutterSound: false,
        skipProcessing: true,
      });

      if (!photo?.base64) {
        throw new Error('Camera snapshot returned no base64 data');
      }

      const rawFrame = {
        width: photo.width && photo.width > 0 ? photo.width : Math.max(screenWidth, screenHeight),
        height: photo.height && photo.height > 0 ? photo.height : Math.min(screenWidth, screenHeight),
      };
      const frame = normalizeFrameSize(rawFrame, screenWidth, screenHeight);
      setFrameSize(frame);

      const result = await invokeDetectShot({
        imageBase64: photo.base64,
        mode: 'calibrate',
        screenMode: true,
      });

      setCalibrationSnapshot({
        uri: `data:image/jpeg;base64,${photo.base64}`,
        ball: result.ballBox ? boxToAnchor(result.ballBox) : DEFAULT_BALL_ANCHOR,
        hoop: result.hoopBox ? boxToAnchor(result.hoopBox) : DEFAULT_HOOP_ANCHOR,
      });
      setSessionPhase('confirm');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Calibration failed';
      const friendly = toFriendlyDetectError(message);
      if (friendly) {
        setCloudDetectError(friendly);
      }
      setSessionPhase('preview');
    }
  }, [screenHeight, screenWidth]);

  const handleConfirmTargets = useCallback(
    (
      ball: TargetAnchor,
      hoop: TargetAnchor,
      displayBall: TargetAnchor,
      displayHoop: TargetAnchor,
    ) => {
      const targets = buildSessionTargets(
        ball,
        hoop,
        displayBall,
        displayHoop,
        frameSize.width,
        frameSize.height,
      );
      setSessionTargets(targets);
      setCalibrationSnapshot(null);
      cloudDetectionRef.current = null;
      setCloudDetection(null);
      setSessionPhase('running');
      setSessionStarted(true);
    },
    [frameSize.height, frameSize.width],
  );

  const handleRetakeCalibration = useCallback(() => {
    setCalibrationSnapshot(null);
    setSessionPhase('preview');
  }, []);

  const handleEndSession = useCallback(() => {
    if (isEnding) {
      return;
    }
    setShowEndConfirm(true);
  }, [isEnding]);

  const handleCancelEndSession = useCallback(() => {
    if (!isEnding) {
      setShowEndConfirm(false);
    }
  }, [isEnding]);

  const handleConfirmEndSession = useCallback(async () => {
    if (isEnding) {
      return;
    }

    setIsEnding(true);
    setShowEndConfirm(false);

    try {
      const completed = await endSession({
        currentStreak: stats.currentStreak,
        bestStreak: stats.bestStreak,
        fgPercent: stats.fgPercent,
      });

      if (completed) {
        router.replace(`/session/summary?sessionId=${completed.id}`);
        return;
      }

      setIsEnding(false);
    } catch (error) {
      console.error('END_SESSION_ERROR:', error);
      setIsEnding(false);
    }
  }, [isEnding, router, stats.bestStreak, stats.currentStreak, stats.fgPercent]);

  if (!hasPermission) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>אין הרשאת מצלמה</Text>
        <Button title="אשר גישה למצלמה" onPress={() => void requestPermission()} />
        <Button title="חזור" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {sessionPhase === 'confirm' && calibrationSnapshot ? (
        <TargetCalibrationView
          imageUri={calibrationSnapshot.uri}
          frameWidth={frameSize.width}
          frameHeight={frameSize.height}
          displayWidth={screenWidth}
          displayHeight={screenHeight}
          initialBall={calibrationSnapshot.ball}
          initialHoop={calibrationSnapshot.hoop}
          onConfirm={handleConfirmTargets}
          onRetake={handleRetakeCalibration}
        />
      ) : (
        <>
      <PreviewCamera
        ref={cameraRef}
        isActive={cameraSessionActive}
        enablePhotoCapture={calibrationPhotoMode || cloudDetectionEnabled}
        enableVideoCapture={highlightRecording}
      />

      <View style={styles.uiLayer} pointerEvents="box-none">
        {sessionPhase === 'preview' && (
          <View style={styles.previewOverlay}>
            <Text style={styles.previewTitle}>כוון את המצלמה לסל ולכדור</Text>
            <Text style={styles.previewHint}>
              נצלם תמונה, תאשר את מיקום הסל והכדור — ואז האימון יתחיל
            </Text>
            <Button
              title="זהה סל וכדור"
              onPress={() => void runCalibrationScan()}
              size="lg"
              fullWidth
            />
          </View>
        )}

        {sessionPhase === 'scanning' && (
          <View style={styles.scanningOverlay}>
            <Text style={styles.scanningText}>מזהה סל וכדור...</Text>
          </View>
        )}

        {useMock && (
          <View style={styles.mockBanner} pointerEvents="none">
            <Text style={styles.mockBannerText}>MOCK — זריקות מדומות</Text>
          </View>
        )}

        {highlightRecording && (
          <View style={styles.recordingBanner} pointerEvents="none">
            <Text style={styles.recordingBannerText}>מקליט זריקה...</Text>
          </View>
        )}

        {isRunning && cloudDetection && (
          <DetectionOverlay
            cloudDetection={cloudDetection}
            displayWidth={screenWidth}
            displayHeight={screenHeight}
            frameWidth={frameSize.width}
            frameHeight={frameSize.height}
            showDebug={debugMode}
          />
        )}

        {!supabaseReady && !useMock && (
          <View style={styles.modelBanner} pointerEvents="none">
            <Text style={styles.modelBannerText}>
              Supabase לא מוגדר — הגדר EXPO_PUBLIC_SUPABASE_URL ו-EXPO_PUBLIC_SUPABASE_ANON_KEY
            </Text>
          </View>
        )}

        {cloudDetectError && (
          <View style={styles.errorBanner} pointerEvents="none">
            <Text style={styles.errorBannerText}>{cloudDetectError}</Text>
          </View>
        )}

        <SwishEffect visible={showSwish} onComplete={() => setShowSwish(false)} />
      </View>

      <View style={styles.controlsLayer} pointerEvents="box-none">
        {isRunning && (
          <View style={styles.topOverlay}>
            <Text style={styles.timer}>{formatTime(elapsed)}</Text>
            {__DEV__ && (
              <>
                <Pressable onPress={() => setDebugMode((d) => !d)}>
                  <Text style={styles.debugBtn}>{debugMode ? 'Debug ON' : 'Debug'}</Text>
                </Pressable>
                <Pressable onPress={() => setUseMock((m) => !m)}>
                  <Text style={[styles.debugBtn, useMock && styles.mockBtnActive]}>
                    {useMock ? 'Mock ON' : 'Cloud AI'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {isRunning && (
        <View style={styles.statsOverlay}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {stats.madeShots}/{stats.totalShots}
            </Text>
            <Text style={styles.statLabel}>{t('session.made')}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, styles.percentValue]}>{stats.fgPercent}%</Text>
            <Text style={styles.statLabel}>{t('session.fgPercent')}</Text>
          </View>
          {stats.currentStreak > 0 && (
            <View style={styles.streakBox}>
              <Text style={styles.streakText}>🔥 {stats.currentStreak}</Text>
            </View>
          )}
        </View>
        )}

        {isRunning && (
        <View style={styles.bottomOverlay}>
          <Pressable
            style={[styles.stopButton, isEnding && styles.stopButtonDisabled]}
            onPress={handleEndSession}
            disabled={isEnding}
            hitSlop={16}
          >
            <View style={styles.stopInner} />
          </Pressable>
          <Text style={styles.stopLabel}>{isEnding ? 'מסיים...' : t('session.stop')}</Text>
        </View>
        )}
      </View>
        </>
      )}

      <Modal
        visible={showEndConfirm}
        transparent
        animationType="fade"
        onRequestClose={handleCancelEndSession}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>{t('session.stop')}</Text>
            <Text style={styles.confirmMessage}>לסיים את האימון?</Text>
            <View style={styles.confirmActions}>
              <Pressable style={styles.confirmCancel} onPress={handleCancelEndSession}>
                <Text style={styles.confirmCancelText}>ביטול</Text>
              </Pressable>
              <Pressable style={styles.confirmEnd} onPress={handleConfirmEndSession}>
                <Text style={styles.confirmEndText}>סיים</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  uiLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
  },
  controlsLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
  },
  fallback: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  fallbackText: {
    color: colors.text,
    fontFamily: 'Rubik_400Regular',
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: spacing.md,
  },
  previewTitle: {
    color: colors.text,
    fontFamily: 'Rubik_700Bold',
    fontSize: 20,
    textAlign: 'center',
  },
  previewHint: {
    color: colors.textSecondary,
    fontFamily: 'Rubik_400Regular',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningText: {
    color: colors.text,
    fontFamily: 'Rubik_600SemiBold',
    fontSize: 18,
  },
  topOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  timer: {
    ...typography.hero,
    color: colors.text,
    fontFamily: 'Rubik_800ExtraBold',
    fontSize: 28,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  debugBtn: {
    color: colors.accent,
    fontSize: 12,
    fontFamily: 'Rubik_600SemiBold',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 6,
    borderRadius: 6,
  },
  mockBtnActive: {
    color: colors.streak,
    backgroundColor: 'rgba(245,158,11,0.35)',
    borderWidth: 1,
    borderColor: colors.streak,
  },
  mockBanner: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(245,158,11,0.85)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  mockBannerText: {
    color: colors.background,
    fontFamily: 'Rubik_700Bold',
    fontSize: 13,
  },
  aiBanner: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(34,197,94,0.9)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  aiBannerText: {
    color: colors.background,
    fontFamily: 'Rubik_700Bold',
    fontSize: 13,
  },
  recordingBanner: {
    position: 'absolute',
    top: 112,
    alignSelf: 'center',
    backgroundColor: 'rgba(239,68,68,0.85)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  recordingBannerText: {
    color: colors.text,
    fontFamily: 'Rubik_700Bold',
    fontSize: 12,
  },
  modelBanner: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(10,10,15,0.85)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modelBannerText: {
    color: colors.textSecondary,
    fontFamily: 'Rubik_400Regular',
    fontSize: 12,
  },
  errorBanner: {
    position: 'absolute',
    top: 112,
    alignSelf: 'center',
    backgroundColor: 'rgba(239,68,68,0.9)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    maxWidth: '90%',
  },
  errorBannerText: {
    color: colors.text,
    fontFamily: 'Rubik_600SemiBold',
    fontSize: 12,
    textAlign: 'center',
  },
  statsOverlay: {
    position: 'absolute',
    left: 16,
    top: '50%',
    transform: [{ translateY: -60 }],
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  statBox: {
    backgroundColor: 'rgba(10,10,15,0.75)',
    borderRadius: 12,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    ...typography.title,
    color: colors.text,
    fontFamily: 'Rubik_800ExtraBold',
  },
  percentValue: {
    color: colors.primary,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: 'Rubik_400Regular',
  },
  streakBox: {
    backgroundColor: 'rgba(245,158,11,0.3)',
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.streak,
  },
  streakText: {
    color: colors.streak,
    fontFamily: 'Rubik_700Bold',
    fontSize: 16,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    alignItems: 'center',
    gap: spacing.xs,
    zIndex: 60,
    elevation: 60,
  },
  stopButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.error,
    zIndex: 61,
    elevation: 61,
  },
  stopButtonDisabled: {
    opacity: 0.5,
  },
  stopInner: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.error,
  },
  stopLabel: {
    color: colors.text,
    fontFamily: 'Rubik_600SemiBold',
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  confirmTitle: {
    ...typography.title,
    color: colors.text,
    fontFamily: 'Rubik_700Bold',
    textAlign: 'center',
  },
  confirmMessage: {
    color: colors.textSecondary,
    fontFamily: 'Rubik_400Regular',
    fontSize: 16,
    textAlign: 'center',
  },
  confirmActions: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  confirmCancel: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.border,
    alignItems: 'center',
  },
  confirmCancelText: {
    color: colors.text,
    fontFamily: 'Rubik_600SemiBold',
  },
  confirmEnd: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  confirmEndText: {
    color: colors.text,
    fontFamily: 'Rubik_700Bold',
  },
});

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as FileSystem from 'expo-file-system/legacy';
import { useCameraPermission } from 'react-native-vision-camera';
import { Button } from '@/src/components/Button';
import { InferenceCamera, type InferenceCameraRef } from '@/src/components/InferenceCamera';
import { LocalDetectionOverlay } from '@/src/components/LocalDetectionOverlay';
import { TargetCalibrationView } from '@/src/components/TargetCalibrationView';
import { SwishEffect } from '@/src/components/SwishEffect';
import { useLiveSession } from '@/src/hooks/useLiveSession';
import { useCameraPipeline } from '@/src/hooks/useCameraPipeline';
import type { FrameDetectionPayload } from '@/src/hooks/useTfliteFrameProcessor';
import { DetectionSmoother, pickBestDetection } from '@/src/cv/detectionSmoother';
import { getEffectiveFrameSize } from '@/src/cv/coordinateMapping';
import { startSession, endSession, getSessionDuration } from '@/src/services/sessionService';
import { initHighlightBuffer, clearHighlightBuffer } from '@/src/services/highlightService';
import { getUserProfile } from '@/src/services/database';
import {
  buildSessionTargets,
  DEFAULT_BALL_ANCHOR,
  DEFAULT_HOOP_ANCHOR,
} from '@/src/services/sessionTargets';
import {
  ACTIVE_MODEL_FILENAME,
  ACTIVE_MODEL_KIND_RESOLVED,
  isModelAssetBundled,
  MODEL_BUNDLE_ERROR,
} from '@/src/models/modelSource';
import type { DetectionBox, SessionTargets, TargetAnchor } from '@/src/types';
import { colors, spacing, typography } from '@/src/theme';

type SessionPhase = 'preview' | 'scanning' | 'confirm' | 'running';

interface CalibrationSnapshot {
  uri: string;
  ball: TargetAnchor;
  hoop: TargetAnchor;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function detectionToAnchor(det: DetectionBox, frameWidth: number, frameHeight: number): TargetAnchor {
  const cx = (det.x + det.width / 2) / frameWidth;
  const cy = (det.y + det.height / 2) / frameHeight;
  const size = Math.max(det.width / frameWidth, det.height / frameHeight, 0.03);
  return { cx, cy, size };
}

function anchorToDetectionBox(
  anchor: TargetAnchor,
  frameWidth: number,
  frameHeight: number,
  classId: DetectionBox['classId'] = 'hoop',
): DetectionBox {
  const pxSize = anchor.size * Math.max(frameWidth, frameHeight);
  const cx = anchor.cx * frameWidth;
  const cy = anchor.cy * frameHeight;
  return {
    x: cx - pxSize / 2,
    y: cy - pxSize / 2,
    width: pxSize,
    height: pxSize,
    confidence: 1,
    classId,
  };
}

function mergeWithCalibratedHoop(
  detections: DetectionBox[],
  targets: SessionTargets | null,
  frameWidth: number,
  frameHeight: number,
): DetectionBox[] {
  if (!targets || frameWidth <= 0 || frameHeight <= 0) {
    return detections;
  }

  const withoutHoop = detections.filter((d) => d.classId !== 'hoop');
  return [...withoutHoop, anchorToDetectionBox(targets.hoop, frameWidth, frameHeight, 'hoop')];
}

export default function LiveSessionScreen() {
  const { t } = useTranslation();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const router = useRouter();
  const { hasPermission, requestPermission } = useCameraPermission();
  const isFocused = useIsFocused();
  const cameraRef = useRef<InferenceCameraRef>(null);
  const smootherRef = useRef(new DetectionSmoother());

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
  const [overlayDetections, setOverlayDetections] = useState<DetectionBox[]>([]);
  const [frameLayout, setFrameLayout] = useState({
    width: 0,
    height: 0,
    orientation: 'landscape-left' as const,
    isMirrored: false,
  });
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const modelBundled = isModelAssetBundled();
  const isRunning = sessionPhase === 'running';
  const isPreview = sessionPhase === 'preview';
  const cameraActive = sessionPhase !== 'confirm';
  const cameraSessionActive = isFocused && cameraActive && !isEnding;
  const inferenceEnabled = modelBundled && !useMock && cameraSessionActive && !showEndConfirm;

  const { stats, showSwish, setShowSwish, processDetections } = useLiveSession({
      confidenceThreshold,
      useMock,
    });

  const handleFrameDetections = useCallback(
    (payload: FrameDetectionPayload) => {
      if (isEnding || showEndConfirm) {
        return;
      }

      const frameWidth = payload.frameWidth;
      const frameHeight = payload.frameHeight;
      if (frameWidth > 0 && frameHeight > 0) {
        setFrameLayout({
          width: getEffectiveFrameSize(frameWidth, frameHeight, screenWidth, screenHeight).width,
          height: getEffectiveFrameSize(frameWidth, frameHeight, screenWidth, screenHeight).height,
          orientation: payload.orientation,
          isMirrored: payload.isMirrored,
        });
      }

      const smoothed = smootherRef.current.smooth(payload.detections);
      const displayDetections = mergeWithCalibratedHoop(
        smoothed,
        sessionTargets,
        frameWidth,
        frameHeight,
      );

      setOverlayDetections(displayDetections);

      if (sessionPhase === 'running') {
        processDetections(smoothed, frameWidth, frameHeight);
      }
    },
    [isEnding, processDetections, screenHeight, screenWidth, sessionPhase, sessionTargets, showEndConfirm],
  );

  const pipeline = useCameraPipeline(handleFrameDetections, inferenceEnabled);

  useEffect(() => {
    if (pipeline.modelState === 'error') {
      setPipelineError('שגיאה בטעינת מודל TFLite — הרץ prebuild מחדש');
      return;
    }
    if (pipeline.modelState === 'missing') {
      setPipelineError(MODEL_BUNDLE_ERROR);
      return;
    }
    if (pipeline.modelLoaded) {
      setPipelineError(null);
    }
  }, [pipeline.modelLoaded, pipeline.modelState]);

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
    if (!hasPermission) {
      void requestPermission();
    }
  }, [hasPermission, requestPermission]);

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

    try {
      const photo = await cameraRef.current.takePhoto({ enableShutterSound: false });
      const base64 = await FileSystem.readAsStringAsync(photo.path, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const rawFrame = {
        width: photo.width > 0 ? photo.width : Math.max(screenWidth, screenHeight),
        height: photo.height > 0 ? photo.height : Math.min(screenWidth, screenHeight),
      };
      const frame = getEffectiveFrameSize(rawFrame.width, rawFrame.height, screenWidth, screenHeight);

      const ballDet = pickBestDetection(overlayDetections, 'ball');
      const hoopDet = pickBestDetection(overlayDetections, 'hoop');

      setCalibrationSnapshot({
        uri: `data:image/jpeg;base64,${base64}`,
        ball: ballDet ? detectionToAnchor(ballDet, frame.width, frame.height) : DEFAULT_BALL_ANCHOR,
        hoop: hoopDet ? detectionToAnchor(hoopDet, frame.width, frame.height) : DEFAULT_HOOP_ANCHOR,
      });
      setSessionPhase('confirm');
    } catch (error) {
      console.error('CALIBRATION_SCAN_ERROR:', error);
      setSessionPhase('preview');
    }
  }, [overlayDetections, screenHeight, screenWidth]);

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
        frameLayout.width,
        frameLayout.height,
      );
      setSessionTargets(targets);
      setCalibrationSnapshot(null);
      smootherRef.current.reset();
      setSessionPhase('running');
      setSessionStarted(true);
    },
    [frameLayout.height, frameLayout.width],
  );

  const handleRetakeCalibration = useCallback(() => {
    setCalibrationSnapshot(null);
    setSessionPhase('preview');
  }, []);

  const handleEndSession = useCallback(() => {
    if (!isEnding) {
      setShowEndConfirm(true);
    }
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

  const modelStatusText = useMemo(() => {
    if (useMock) {
      return 'Mock detection';
    }
    if (pipeline.modelState === 'loading') {
      return 'טוען מודל TFLite...';
    }
    if (pipeline.modelLoaded) {
      return `מודל מקומי: ${ACTIVE_MODEL_KIND_RESOLVED} (${ACTIVE_MODEL_FILENAME})`;
    }
    return 'מודל חסר';
  }, [pipeline.modelLoaded, pipeline.modelState, useMock]);

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
          frameWidth={frameLayout.width}
          frameHeight={frameLayout.height}
          displayWidth={screenWidth}
          displayHeight={screenHeight}
          initialBall={calibrationSnapshot.ball}
          initialHoop={calibrationSnapshot.hoop}
          onConfirm={handleConfirmTargets}
          onRetake={handleRetakeCalibration}
        />
      ) : (
        <>
          <InferenceCamera
            ref={cameraRef}
            isActive={cameraSessionActive}
            frameProcessor={pipeline.frameProcessor}
          />

          <View style={styles.uiLayer} pointerEvents="box-none">
            {(isPreview || isRunning) && frameLayout.width > 0 && (
              <LocalDetectionOverlay
                detections={overlayDetections}
                frameWidth={frameLayout.width}
                frameHeight={frameLayout.height}
                displayWidth={screenWidth}
                displayHeight={screenHeight}
                orientation={frameLayout.orientation}
                isMirrored={frameLayout.isMirrored}
                showDebug={debugMode}
                previewMode={isPreview}
              />
            )}

            {isPreview && (
              <View style={styles.previewOverlay} pointerEvents="box-none">
                <Text style={styles.previewTitle}>כוון את המצלמה לסל ולכדור</Text>
                <Text style={styles.previewHint}>
                  זיהוי מקומי בזמן אמת (COCO: כדור + שחקן). גרור את הסל ידנית באישור.
                </Text>
                <Button
                  title="צלם ואשר מיקומים"
                  onPress={() => void runCalibrationScan()}
                  size="lg"
                  fullWidth
                />
              </View>
            )}

            {sessionPhase === 'scanning' && (
              <View style={styles.scanningOverlay}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.scanningText}>שומר פריים...</Text>
              </View>
            )}

            {pipeline.modelState === 'loading' && (
              <View style={styles.modelBanner} pointerEvents="none">
                <Text style={styles.modelBannerText}>{modelStatusText}</Text>
              </View>
            )}

            {pipelineError && (
              <View style={styles.errorBanner} pointerEvents="none">
                <Text style={styles.errorBannerText}>{pipelineError}</Text>
              </View>
            )}

            {useMock && (
              <View style={styles.mockBanner} pointerEvents="none">
                <Text style={styles.mockBannerText}>MOCK — זריקות מדומות</Text>
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
                        {useMock ? 'Mock ON' : 'TFLite'}
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
  container: { flex: 1, backgroundColor: colors.background },
  uiLayer: { ...StyleSheet.absoluteFillObject, zIndex: 10, elevation: 10 },
  controlsLayer: { ...StyleSheet.absoluteFillObject, zIndex: 50, elevation: 50 },
  fallback: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  fallbackText: { color: colors.text, fontFamily: 'Rubik_400Regular' },
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
    gap: spacing.md,
  },
  scanningText: { color: colors.text, fontFamily: 'Rubik_600SemiBold', fontSize: 18 },
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
  mockBannerText: { color: colors.background, fontFamily: 'Rubik_700Bold', fontSize: 13 },
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
  modelBannerText: { color: colors.textSecondary, fontFamily: 'Rubik_400Regular', fontSize: 12 },
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
  statValue: { ...typography.title, color: colors.text, fontFamily: 'Rubik_800ExtraBold' },
  percentValue: { color: colors.primary },
  statLabel: { color: colors.textSecondary, fontSize: 11, fontFamily: 'Rubik_400Regular' },
  streakBox: {
    backgroundColor: 'rgba(245,158,11,0.3)',
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.streak,
  },
  streakText: { color: colors.streak, fontFamily: 'Rubik_700Bold', fontSize: 16 },
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
  stopButtonDisabled: { opacity: 0.5 },
  stopInner: { width: 28, height: 28, borderRadius: 6, backgroundColor: colors.error },
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
  confirmActions: { flexDirection: 'row-reverse', gap: spacing.sm, marginTop: spacing.sm },
  confirmCancel: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.border,
    alignItems: 'center',
  },
  confirmCancelText: { color: colors.text, fontFamily: 'Rubik_600SemiBold' },
  confirmEnd: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  confirmEndText: { color: colors.text, fontFamily: 'Rubik_700Bold' },
});

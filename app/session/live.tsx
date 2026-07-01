import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useCameraDevice, useCameraPermission, type Camera } from 'react-native-vision-camera';
import { Button } from '@/src/components/Button';
import { PreviewCamera } from '@/src/components/PreviewCamera';
import { DetectionOverlay } from '@/src/components/DetectionOverlay';
import { SwishEffect } from '@/src/components/SwishEffect';
import { useLiveSession } from '@/src/hooks/useLiveSession';
import { useCloudShotDetection } from '@/src/hooks/useCloudShotDetection';
import { isSupabaseConfigured } from '@/src/lib/supabase';
import type { DetectShotResponse } from '@/src/services/detectShotService';
import { startSession, endSession, getSessionDuration } from '@/src/services/sessionService';
import { initHighlightBuffer, clearHighlightBuffer } from '@/src/services/highlightService';
import { getUserProfile } from '@/src/services/database';
import { colors, spacing, typography } from '@/src/theme';

const CLOUD_DETECT_INTERVAL_MS = 1500;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function LiveSessionScreen() {
  const { t } = useTranslation();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const router = useRouter();
  const { hasPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const isFocused = useIsFocused();
  const cameraRef = useRef<Camera>(null);

  const [cameraActive, setCameraActive] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [calibration, setCalibration] = useState<import('@/src/types').CourtCalibration | undefined>(
    undefined
  );
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);
  const [debugMode, setDebugMode] = useState(__DEV__);
  const [useMock, setUseMock] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [cloudDetection, setCloudDetection] = useState<DetectShotResponse | null>(null);
  const [cloudDetectError, setCloudDetectError] = useState<string | null>(null);

  const supabaseReady = isSupabaseConfigured();
  const cameraSessionActive = isFocused && cameraActive && !isEnding;
  const cloudDetectionActive =
    supabaseReady && !useMock && cameraSessionActive && !showEndConfirm;

  const { stats, showSwish, setShowSwish, processCloudShot } = useLiveSession({
    calibration,
    confidenceThreshold,
    useMock,
  });

  const handleCloudDetection = useCallback((result: DetectShotResponse) => {
    if (isEnding || showEndConfirm) {
      return;
    }

    setCloudDetectError(null);
    setCloudDetection(result);
  }, [isEnding, showEndConfirm]);

  const handleCloudDetectError = useCallback((message: string) => {
    setCloudDetectError(message);
  }, []);

  const handleCloudShot = useCallback(
    (result: DetectShotResponse) => {
      if (isEnding || showEndConfirm) {
        return;
      }

      void processCloudShot(result);
    },
    [isEnding, processCloudShot, showEndConfirm]
  );

  useCloudShotDetection({
    cameraRef,
    enabled: cloudDetectionActive,
    confidenceThreshold,
    intervalMs: CLOUD_DETECT_INTERVAL_MS,
    onDetection: handleCloudDetection,
    onShot: handleCloudShot,
    onError: handleCloudDetectError,
  });

  useEffect(() => {
    getUserProfile().then((profile) => {
      setCalibration(profile.courtCalibration);
      setConfidenceThreshold(profile.confidenceThreshold);
    });
  }, []);

  useEffect(() => {
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
    setCameraActive(false);

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
      setCameraActive(true);
    } catch (error) {
      console.error('END_SESSION_ERROR:', error);
      setIsEnding(false);
      setCameraActive(true);
    }
  }, [isEnding, router, stats.bestStreak, stats.currentStreak, stats.fgPercent]);

  if (!hasPermission || !device) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>
          {!hasPermission ? 'אין הרשאת מצלמה' : 'מצלמה לא זמינה'}
        </Text>
        <Button title="חזור" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PreviewCamera
        ref={cameraRef}
        device={device}
        isActive={cameraSessionActive}
        enablePhotoCapture={cloudDetectionActive}
      />

      <View style={styles.uiLayer} pointerEvents="box-none">
        {useMock && (
          <View style={styles.mockBanner} pointerEvents="none">
            <Text style={styles.mockBannerText}>MOCK — זריקות מדומות</Text>
          </View>
        )}

        {cloudDetectionActive && (
          <View style={styles.aiBanner} pointerEvents="none">
            <Text style={styles.aiBannerText}>Cloud AI — זיהוי שרת פעיל</Text>
          </View>
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

        {(debugMode ||
          cloudDetection?.event === 'shot_made' ||
          cloudDetection?.event === 'shot_missed') &&
          cloudDetectionActive && (
          <DetectionOverlay
            detections={[]}
            frameWidth={screenWidth}
            frameHeight={screenHeight}
            displayWidth={screenWidth}
            displayHeight={screenHeight}
            cloudDetection={cloudDetection}
          />
        )}

        <SwishEffect visible={showSwish} onComplete={() => setShowSwish(false)} />
      </View>

      <View style={styles.controlsLayer} pointerEvents="box-none">
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
      </View>

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
  topOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 0,
    right: 0,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  timer: {
    ...typography.hero,
    color: colors.text,
    fontFamily: 'Rubik_800ExtraBold',
    fontSize: 36,
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
    top: Platform.OS === 'ios' ? 100 : 80,
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
    top: Platform.OS === 'ios' ? 100 : 80,
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
  modelBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
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
    top: Platform.OS === 'ios' ? 132 : 112,
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
    top: Platform.OS === 'ios' ? 120 : 100,
    right: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-end',
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
    bottom: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 60,
    elevation: 60,
  },
  stopButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
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

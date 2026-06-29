import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { Button } from '@/src/components/Button';
import { DetectionOverlay } from '@/src/components/DetectionOverlay';
import { SwishEffect } from '@/src/components/SwishEffect';
import { useLiveSession } from '@/src/hooks/useLiveSession';
import { useCameraPipeline } from '@/src/hooks/useCameraPipeline';
import { startSession, endSession, getSessionDuration } from '@/src/services/sessionService';
import { initHighlightBuffer, clearHighlightBuffer } from '@/src/services/highlightService';
import { getUserProfile } from '@/src/services/database';
import { colors, spacing, typography } from '@/src/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function LiveSessionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { hasPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);
  const [elapsed, setElapsed] = useState(0);
  const [calibration, setCalibration] = useState<import('@/src/types').CourtCalibration | undefined>(undefined);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);
  const [debugMode, setDebugMode] = useState(__DEV__);
  const [useMock, setUseMock] = useState(true);

  const { detections, stats, showSwish, setShowSwish, processDetections } = useLiveSession({
    calibration,
    confidenceThreshold,
    useMock,
  });

  const { frameProcessor, modelLoaded } = useCameraPipeline(processDetections, !useMock);

  useEffect(() => {
    if (modelLoaded) setUseMock(false);
  }, [modelLoaded]);

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
    Alert.alert(t('session.stop'), 'לסיים את האימון?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'סיים',
        style: 'destructive',
        onPress: async () => {
          const completed = await endSession({
            currentStreak: stats.currentStreak,
            bestStreak: stats.bestStreak,
            fgPercent: stats.fgPercent,
          });
          if (completed) {
            router.replace(`/session/summary?sessionId=${completed.id}`);
          }
        },
      },
    ]);
  }, [stats, router, t]);

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
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        video
        audio={false}
        frameProcessor={frameProcessor}
      />

      {debugMode && detections.length > 0 && (
        <DetectionOverlay
          detections={detections}
          frameWidth={320}
          frameHeight={480}
          displayWidth={SCREEN_WIDTH}
          displayHeight={SCREEN_HEIGHT}
        />
      )}

      <SwishEffect visible={showSwish} onComplete={() => setShowSwish(false)} />

      <View style={styles.topOverlay}>
        <Text style={styles.timer}>{formatTime(elapsed)}</Text>
        {__DEV__ && (
          <Pressable onPress={() => setDebugMode((d) => !d)}>
            <Text style={styles.debugBtn}>{debugMode ? 'Debug ON' : 'Debug'}</Text>
          </Pressable>
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
        <Pressable style={styles.stopButton} onPress={handleEndSession}>
          <View style={styles.stopInner} />
        </Pressable>
        <Text style={styles.stopLabel}>{t('session.stop')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
});

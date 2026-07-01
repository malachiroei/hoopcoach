import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Camera, useCameraPermission } from 'react-native-vision-camera';
import { Button } from '@/src/components/Button';
import {
  CourtCalibrationView,
  CalibrationMarkersOverlay,
  type CourtSize,
} from '@/src/components/CourtCalibrationView';
import { updateUserProfile } from '@/src/services/database';
import type { CourtCalibration, Point2D } from '@/src/types';
import { colors, spacing, typography } from '@/src/theme';

export default function SessionSetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [activePointCount, setActivePointCount] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [tapPoints, setTapPoints] = useState<Point2D[]>([]);
  const [courtSize, setCourtSize] = useState<CourtSize | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  useEffect(() => {
    if (hasPermission) {
      const devices = Camera.getAvailableCameraDevices();
      setCameraReady(devices.length > 0);
    }
  }, [hasPermission]);

  const handleCalibration = useCallback(async (points: Point2D[]) => {
    const newCalibration: CourtCalibration = {
      points,
      calibratedAt: Date.now(),
    };
    setSessionComplete(true);
    await updateUserProfile({ courtCalibration: newCalibration });
  }, []);

  const handlePointsChange = useCallback((count: number) => {
    setActivePointCount(count);
    if (count < 4) {
      setSessionComplete(false);
    }
  }, []);

  const canStart = hasPermission && cameraReady && sessionComplete;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="always"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{t('session.setup')}</Text>

      <View style={styles.statsBar}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>{t('session.calibrate')}</Text>
          <Text style={styles.statValue}>
            {t('session.pointsMarked', { count: activePointCount })}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>יעד</Text>
          <Text style={styles.statValue}>4 / 4</Text>
        </View>
      </View>

      <View style={styles.calibrationFrame}>
        <CourtCalibrationView
          onComplete={handleCalibration}
          initialPoints={[]}
          onPointsChange={handlePointsChange}
          onPointsUpdate={setTapPoints}
          onCourtSizeChange={setCourtSize}
          cameraEnabled={hasPermission}
        />
        {courtSize ? (
          <CalibrationMarkersOverlay
            points={tapPoints}
            width={courtSize.width}
            height={courtSize.height}
          />
        ) : null}
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotPending]} />
          <Text style={styles.legendText}>נקודת כיול</Text>
        </View>
      </View>

      <Text style={styles.hint}>{t('session.calibrateHint')}</Text>
      <Text style={styles.resetHint}>לחיצה ארוכה על המגרש לאיפוס הנקודות</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('session.cameraCheck')}</Text>
        <View style={styles.cameraStatus}>
          <Text style={styles.statusIcon}>{hasPermission && cameraReady ? '✅' : '⚠️'}</Text>
          <Text style={styles.statusText}>
            {hasPermission && cameraReady
              ? t('session.cameraReady')
              : hasPermission
                ? 'מחפש מצלמה...'
                : 'נדרשת הרשאת מצלמה'}
          </Text>
        </View>
        {!hasPermission && (
          <Button title="אשר גישה למצלמה" onPress={requestPermission} variant="secondary" />
        )}
      </View>

      <Button
        title={t('session.startTraining')}
        onPress={() => router.push('/session/live')}
        fullWidth
        size="lg"
        disabled={!canStart}
      />

      {sessionComplete && canStart && (
        <Text style={styles.successHint}>הכיול הושלם — אפשר להתחיל אימון</Text>
      )}

      {!sessionComplete && (
        <Text style={styles.warning}>יש לסמן 4 נקודות לפני תחילת האימון</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    direction: 'ltr',
  },
  scrollContent: {
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl + 16,
    gap: spacing.md,
  },
  title: {
    ...typography.hero,
    color: colors.text,
    fontFamily: 'Rubik_800ExtraBold',
    fontSize: 28,
    textAlign: 'right',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  statCell: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: 'Rubik_400Regular',
  },
  statValue: {
    color: colors.text,
    fontSize: 16,
    fontFamily: 'Rubik_700Bold',
  },
  calibrationFrame: {
    position: 'relative',
    alignSelf: 'center',
    direction: 'ltr',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  legendDotPending: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 107, 0, 0.2)',
  },
  legendText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: 'Rubik_400Regular',
  },
  section: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontFamily: 'Rubik_700Bold',
    textAlign: 'right',
  },
  hint: {
    color: colors.textSecondary,
    fontFamily: 'Rubik_400Regular',
    lineHeight: 22,
    textAlign: 'center',
  },
  resetHint: {
    color: colors.textMuted,
    fontFamily: 'Rubik_400Regular',
    fontSize: 12,
    textAlign: 'center',
  },
  cameraStatus: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusIcon: {
    fontSize: 24,
  },
  statusText: {
    color: colors.text,
    fontFamily: 'Rubik_400Regular',
  },
  successHint: {
    color: colors.success,
    textAlign: 'center',
    fontSize: 13,
    fontFamily: 'Rubik_600SemiBold',
  },
  warning: {
    color: colors.error,
    textAlign: 'center',
    fontSize: 13,
    fontFamily: 'Rubik_400Regular',
  },
});

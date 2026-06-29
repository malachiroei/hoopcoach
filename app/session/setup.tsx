import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Camera, useCameraPermission } from 'react-native-vision-camera';
import { Button } from '@/src/components/Button';
import { CourtCalibrationView } from '@/src/components/CourtCalibrationView';
import { getUserProfile, updateUserProfile } from '@/src/services/database';
import { isCalibrationComplete } from '@/src/cv/courtMapper';
import type { CourtCalibration, Point2D } from '@/src/types';
import { colors, spacing, typography } from '@/src/theme';

export default function SessionSetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [calibration, setCalibration] = useState<CourtCalibration | null>(null);
  const [pointsCount, setPointsCount] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    getUserProfile().then((profile) => {
      if (profile.courtCalibration) {
        setCalibration(profile.courtCalibration);
        setPointsCount(profile.courtCalibration.points.length);
      }
    });
    requestPermission();
  }, [requestPermission]);

  useEffect(() => {
    if (hasPermission) {
      const devices = Camera.getAvailableCameraDevices();
      setCameraReady(devices.length > 0);
    }
  }, [hasPermission]);

  const handleCalibration = async (points: Point2D[]) => {
    const newCalibration: CourtCalibration = {
      points,
      calibratedAt: Date.now(),
    };
    setCalibration(newCalibration);
    setPointsCount(points.length);
    await updateUserProfile({ courtCalibration: newCalibration });
  };

  const canStart = hasPermission && cameraReady && isCalibrationComplete(calibration ?? undefined);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('session.setup')}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('session.calibrate')}</Text>
        <Text style={styles.hint}>{t('session.calibrateHint')}</Text>
        <Text style={styles.pointsCount}>
          {t('session.pointsMarked', { count: pointsCount })}
        </Text>
        <CourtCalibrationView
          onComplete={handleCalibration}
          initialPoints={calibration?.points}
        />
      </View>

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

      {!isCalibrationComplete(calibration ?? undefined) && (
        <Text style={styles.warning}>יש לסמן 4 נקודות לפני תחילת האימון</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.hero,
    color: colors.text,
    fontFamily: 'Rubik_800ExtraBold',
    fontSize: 32,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontFamily: 'Rubik_700Bold',
  },
  hint: {
    color: colors.textSecondary,
    fontFamily: 'Rubik_400Regular',
    lineHeight: 22,
  },
  pointsCount: {
    color: colors.primary,
    fontFamily: 'Rubik_600SemiBold',
    fontSize: 14,
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
  warning: {
    color: colors.error,
    textAlign: 'center',
    fontSize: 13,
    fontFamily: 'Rubik_400Regular',
  },
});

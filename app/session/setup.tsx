import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Button } from '@/src/components/Button';
import { colors, spacing, typography } from '@/src/theme';

export default function SessionSetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const hasPermission = permission?.granted ?? false;

  useEffect(() => {
    if (!permission?.granted) {
      void requestPermission();
    }
  }, [permission?.granted, requestPermission]);

  useEffect(() => {
    if (!micPermission?.granted) {
      void requestMicPermission();
    }
  }, [micPermission?.granted, requestMicPermission]);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{t('session.setup')}</Text>
      <Text style={styles.hint}>
        כוון את המצלמה לסל. לפני האימון תאשר את מיקום הסל והכדור על המסך.
      </Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusLine}>
          {hasPermission ? '✅ מצלמה מוכנה' : '⚠️ נדרשת הרשאת מצלמה'}
        </Text>
        <Text style={styles.statusLine}>
          {micPermission?.granted ? '✅ מיקרופון מוכן' : '⚠️ מיקרופון (להיילייטס)'}
        </Text>
        <Text style={styles.statusLine}>📱 באימון המסך יעבור אוטומטית לרוחב</Text>
      </View>

      {!hasPermission && (
        <Button title="אשר גישה למצלמה" onPress={() => void requestPermission()} fullWidth />
      )}

      <Button
        title={t('session.startTraining')}
        onPress={() => router.replace('/session/live')}
        fullWidth
        size="lg"
        disabled={!hasPermission}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  title: {
    ...typography.hero,
    color: colors.text,
    fontFamily: 'Rubik_800ExtraBold',
    fontSize: 28,
    textAlign: 'center',
  },
  hint: {
    color: colors.textSecondary,
    fontFamily: 'Rubik_400Regular',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  statusLine: {
    color: colors.text,
    fontFamily: 'Rubik_400Regular',
    fontSize: 15,
    textAlign: 'right',
  },
});

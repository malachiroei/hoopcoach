import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { colors, spacing, typography } from '@/src/theme';

export default function AboutModal() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.emoji}>🏀</Text>
      <Text style={styles.title}>HoopCoach</Text>
      <Text style={styles.version}>גרסה 1.0.0</Text>
      <Text style={styles.desc}>
        המאמן האישי שלך בכדורסל. האפליקציה עוקבת אחרי הזריקות שלך באמצעות המצלמה,
        מספקת סטטיסטיקות בזמן אמת, יוצרת היילייטס ונותנת המלצות לשיפור.
      </Text>
      <Text style={styles.note}>
        לשימוש מיטבי: הצב את הטלפון על חצובה בזווית קבועה המכסה את הסל והשחקן.
      </Text>
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
    alignItems: 'center',
    gap: spacing.md,
  },
  emoji: {
    fontSize: 64,
    marginTop: spacing.lg,
  },
  title: {
    ...typography.hero,
    color: colors.text,
    fontFamily: 'Rubik_800ExtraBold',
  },
  version: {
    color: colors.textMuted,
    fontFamily: 'Rubik_400Regular',
  },
  desc: {
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'Rubik_400Regular',
  },
  note: {
    color: colors.primary,
    textAlign: 'center',
    fontSize: 13,
    fontFamily: 'Rubik_600SemiBold',
    marginTop: spacing.md,
  },
});

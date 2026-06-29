import { useCallback, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BadgeGrid } from '@/src/components/BadgeGrid';
import { XpBar } from '@/src/components/XpBar';
import { getUserProfile, updateUserProfile, getEarnedBadges } from '@/src/services/database';
import { ALL_BADGES, getXpLevel } from '@/src/services/gamificationService';
import type { Badge } from '@/src/types';
import { colors, spacing, borderRadius, typography } from '@/src/theme';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [profile, setProfile] = useState({ name: 'שחקן', totalXp: 0, confidenceThreshold: 0.5 });
  const [badges, setBadges] = useState<Badge[]>(ALL_BADGES);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async () => {
    const userProfile = await getUserProfile();
    const earned = await getEarnedBadges();
    setProfile({
      name: userProfile.name,
      totalXp: userProfile.totalXp,
      confidenceThreshold: userProfile.confidenceThreshold,
    });
    setBadges(
      ALL_BADGES.map((b) => ({
        ...b,
        earnedAt: earned.includes(b.id) ? Date.now() : undefined,
      }))
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const adjustThreshold = async (delta: number) => {
    const newVal = Math.max(0.2, Math.min(0.9, profile.confidenceThreshold + delta));
    await updateUserProfile({ confidenceThreshold: newVal });
    setProfile((p) => ({ ...p, confidenceThreshold: newVal }));
  };

  const resetOnboarding = async () => {
    await updateUserProfile({ onboardingComplete: false });
    router.replace('/onboarding');
  };

  const xpLevel = getXpLevel(profile.totalXp);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>🏀</Text>
      </View>
      <Text style={styles.name}>{profile.name}</Text>

      <XpBar level={xpLevel.level} progress={xpLevel.progress} totalXp={profile.totalXp} />

      <Text style={styles.sectionTitle}>{t('profile.badges')}</Text>
      <BadgeGrid badges={badges} />

      <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>
      <View style={styles.setting}>
        <Text style={styles.settingLabel}>{t('profile.confidenceThreshold')}</Text>
        <View style={styles.thresholdRow}>
          <Pressable style={styles.thresholdBtn} onPress={() => adjustThreshold(-0.1)}>
            <Text style={styles.thresholdBtnText}>−</Text>
          </Pressable>
          <Text style={styles.thresholdValue}>{(profile.confidenceThreshold * 100).toFixed(0)}%</Text>
          <Pressable style={styles.thresholdBtn} onPress={() => adjustThreshold(0.1)}>
            <Text style={styles.thresholdBtnText}>+</Text>
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.resetBtn} onPress={resetOnboarding}>
        <Text style={styles.resetText}>{t('profile.resetOnboarding')}</Text>
      </Pressable>
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
    paddingBottom: spacing.xxl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarText: {
    fontSize: 40,
  },
  name: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
    fontFamily: 'Rubik_800ExtraBold',
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontFamily: 'Rubik_700Bold',
    marginTop: spacing.sm,
  },
  setting: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingLabel: {
    color: colors.textSecondary,
    fontFamily: 'Rubik_400Regular',
    marginBottom: spacing.sm,
  },
  thresholdRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  thresholdBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  thresholdBtnText: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  thresholdValue: {
    ...typography.title,
    color: colors.text,
    fontFamily: 'Rubik_700Bold',
    minWidth: 60,
    textAlign: 'center',
  },
  resetBtn: {
    alignItems: 'center',
    padding: spacing.md,
  },
  resetText: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: 'Rubik_400Regular',
  },
});

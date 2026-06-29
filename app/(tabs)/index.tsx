import { useCallback, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { StatBadge } from '@/src/components/StatBadge';
import { XpBar } from '@/src/components/XpBar';
import { getAllSessions, getUserProfile } from '@/src/services/database';
import { computeFgPercent } from '@/src/services/statsService';
import { getXpLevel } from '@/src/services/gamificationService';
import type { Session } from '@/src/types';
import { colors, spacing, typography } from '@/src/theme';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [profile, setProfile] = useState({ name: 'שחקן', totalXp: 0 });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [userProfile, allSessions] = await Promise.all([
      getUserProfile(),
      getAllSessions(),
    ]);
    setProfile({ name: userProfile.name, totalXp: userProfile.totalXp });
    setSessions(allSessions);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const lastSession = sessions[0];
  const totalShots = sessions.reduce((s, sess) => s + sess.totalShots, 0);
  const totalMade = sessions.reduce((s, sess) => s + sess.madeShots, 0);
  const xpLevel = getXpLevel(profile.totalXp);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Animated.View entering={FadeInDown.delay(100)}>
        <Text style={styles.greeting}>{t('home.greeting', { name: profile.name })}</Text>
        <Text style={styles.tagline}>{t('app.tagline')}</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200)}>
        <XpBar level={xpLevel.level} progress={xpLevel.progress} totalXp={profile.totalXp} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300)}>
        <Button
          title={`🏀  ${t('home.startSession')}`}
          onPress={() => router.push('/session/setup')}
          fullWidth
          size="lg"
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400)}>
        <Card title={t('home.stats')}>
          <View style={styles.statsRow}>
            <StatBadge
              label={t('home.fgPercent')}
              value={`${computeFgPercent(totalMade, totalShots)}%`}
            />
            <StatBadge label={t('home.totalShots')} value={totalShots} />
            <StatBadge label={t('home.sessions')} value={sessions.length} />
          </View>
        </Card>
      </Animated.View>

      {lastSession && (
        <Animated.View entering={FadeInDown.delay(500)}>
          <Card title={t('home.lastSession')}>
            <View style={styles.lastSession}>
              <Text style={styles.lastSessionDate}>
                {new Date(lastSession.startedAt).toLocaleDateString('he-IL')}
              </Text>
              <Text style={styles.lastSessionStats}>
                {lastSession.madeShots}/{lastSession.totalShots} ·{' '}
                {computeFgPercent(lastSession.madeShots, lastSession.totalShots)}%
              </Text>
              <Text style={styles.lastSessionXp}>+{lastSession.xpEarned} XP</Text>
            </View>
          </Card>
        </Animated.View>
      )}

      {sessions.length === 0 && (
        <Text style={styles.empty}>{t('home.noSessions')}</Text>
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
    paddingBottom: spacing.xxl,
  },
  greeting: {
    ...typography.title,
    color: colors.text,
    fontFamily: 'Rubik_800ExtraBold',
    fontSize: 28,
  },
  tagline: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontFamily: 'Rubik_400Regular',
  },
  statsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    marginTop: spacing.sm,
  },
  lastSession: {
    alignItems: 'flex-end',
  },
  lastSessionDate: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: 'Rubik_400Regular',
  },
  lastSessionStats: {
    ...typography.subtitle,
    color: colors.primary,
    fontFamily: 'Rubik_700Bold',
    marginTop: 4,
  },
  lastSessionXp: {
    color: colors.accent,
    fontSize: 13,
    marginTop: 2,
    fontFamily: 'Rubik_600SemiBold',
  },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    fontFamily: 'Rubik_400Regular',
  },
});

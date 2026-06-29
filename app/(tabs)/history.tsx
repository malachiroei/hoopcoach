import { useCallback, useState } from 'react';
import { StyleSheet, Text, View, FlatList, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getAllSessions } from '@/src/services/database';
import { computeFgPercent } from '@/src/services/statsService';
import type { Session } from '@/src/types';
import { colors, spacing, borderRadius, typography } from '@/src/theme';

export default function HistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadSessions = useCallback(async () => {
    const data = await getAllSessions();
    setSessions(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0 דק';
    const mins = Math.floor(seconds / 60);
    return `${mins} ${t('session.minutes')}`;
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('history.empty')}</Text>
        }
        renderItem={({ item }) => (
          <View
            style={styles.card}
            onTouchEnd={() => router.push(`/session/summary?sessionId=${item.id}`)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.date}>
                {new Date(item.startedAt).toLocaleDateString('he-IL', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </Text>
              <Text style={styles.duration}>{formatDuration(item.durationSeconds)}</Text>
            </View>
            <Text style={styles.stats}>
              {t('history.shots', {
                made: item.madeShots,
                total: item.totalShots,
                percent: computeFgPercent(item.madeShots, item.totalShots),
              })}
            </Text>
            <Text style={styles.xp}>+{item.xpEarned} XP</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  date: {
    ...typography.subtitle,
    color: colors.text,
    fontFamily: 'Rubik_600SemiBold',
  },
  duration: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: 'Rubik_400Regular',
  },
  stats: {
    ...typography.title,
    color: colors.primary,
    fontFamily: 'Rubik_800ExtraBold',
  },
  xp: {
    color: colors.accent,
    fontSize: 13,
    marginTop: 4,
    fontFamily: 'Rubik_600SemiBold',
  },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xxl,
    fontFamily: 'Rubik_400Regular',
  },
});

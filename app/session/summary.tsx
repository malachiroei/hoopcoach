import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { StatBadge } from '@/src/components/StatBadge';
import { ShotHeatMap } from '@/src/components/ShotHeatMap';
import { RecommendationCard } from '@/src/components/RecommendationCard';
import { HighlightPlayer } from '@/src/components/HighlightPlayer';
import { getSession, getShotsForSession } from '@/src/services/database';
import { getSessionHighlights } from '@/src/services/highlightService';
import { generateRecommendations } from '@/src/services/recommendationEngine';
import { statsService } from '@/src/services/statsService';
import { createEmptyZoneStats } from '@/src/services/sessionService';
import type { Highlight, Recommendation, Session, Shot } from '@/src/types';
import { colors, spacing, typography } from '@/src/theme';

export default function SummaryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [zoneStats, setZoneStats] = useState(createEmptyZoneStats());

  useEffect(() => {
    if (!sessionId) return;

    async function load() {
      const sess = await getSession(sessionId);
      if (!sess) return;

      const sessionShots = await getShotsForSession(sessionId);
      const sessionHighlights = await getSessionHighlights(sessionId);

      statsService.reset();
      let stats = statsService.getStats();
      for (const shot of sessionShots) {
        stats = statsService.addShot(shot);
      }

      setSession(sess);
      setShots(sessionShots);
      setHighlights(sessionHighlights);
      setZoneStats(stats.zoneStats);

      const recs = await generateRecommendations(sess, stats);
      setRecommendations(recs);
    }

    load();
  }, [sessionId]);

  const handleShare = async () => {
    if (!session) return;
    const fg = session.totalShots > 0
      ? Math.round((session.madeShots / session.totalShots) * 100)
      : 0;

    await Share.share({
      message: `🏀 סיכום אימון HoopCoach\n${session.madeShots}/${session.totalShots} זריקות · ${fg}%\n+${session.xpEarned} XP`,
    });
  };

  if (!session) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>טוען...</Text>
      </View>
    );
  }

  const fgPercent = session.totalShots > 0
    ? Math.round((session.madeShots / session.totalShots) * 100)
    : 0;

  const durationMin = Math.floor((session.durationSeconds ?? 0) / 60);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Animated.View entering={FadeInUp.delay(100)}>
        <Text style={styles.title}>{t('session.summary')}</Text>
        <Text style={styles.date}>
          {new Date(session.startedAt).toLocaleDateString('he-IL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(200)}>
        <Card>
          <View style={styles.mainStats}>
            <StatBadge
              label={t('session.fgPercent')}
              value={`${fgPercent}%`}
              large
              accent={fgPercent >= 50 ? colors.success : colors.primary}
            />
          </View>
          <View style={styles.statsRow}>
            <StatBadge
              label={t('session.shots')}
              value={`${session.madeShots}/${session.totalShots}`}
            />
            <StatBadge
              label={t('session.duration')}
              value={`${durationMin} ${t('session.minutes')}`}
            />
            <StatBadge label="XP" value={`+${session.xpEarned}`} accent={colors.accent} />
          </View>
        </Card>
      </Animated.View>

      {shots.length > 0 && (
        <Animated.View entering={FadeInUp.delay(300)}>
          <ShotHeatMap zoneStats={zoneStats} />
        </Animated.View>
      )}

      <Animated.View entering={FadeInUp.delay(400)}>
        <Text style={styles.sectionTitle}>{t('session.highlights')}</Text>
        <HighlightPlayer highlights={highlights} />
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(500)}>
        <RecommendationCard recommendations={recommendations} />
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(600)} style={styles.actions}>
        <Button title={t('session.share')} onPress={handleShare} variant="secondary" fullWidth />
        <Button title={t('session.done')} onPress={() => router.replace('/(tabs)')} fullWidth size="lg" />
      </Animated.View>
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
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    fontFamily: 'Rubik_400Regular',
  },
  title: {
    ...typography.hero,
    color: colors.text,
    fontFamily: 'Rubik_800ExtraBold',
    fontSize: 32,
  },
  date: {
    color: colors.textSecondary,
    fontFamily: 'Rubik_400Regular',
    marginTop: spacing.xs,
  },
  mainStats: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontFamily: 'Rubik_700Bold',
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});

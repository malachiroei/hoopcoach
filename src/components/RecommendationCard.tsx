import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Recommendation } from '@/src/types';
import { colors, borderRadius, spacing, typography } from '@/src/theme';

interface RecommendationCardProps {
  recommendations: Recommendation[];
}

const priorityIcons: Record<Recommendation['priority'], string> = {
  high: '🎯',
  medium: '💡',
  low: '⭐',
};

export function RecommendationCard({ recommendations }: RecommendationCardProps) {
  const { t } = useTranslation();

  if (recommendations.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('session.recommendations')}</Text>
      {recommendations.map((rec) => (
        <View key={rec.id} style={styles.item}>
          <Text style={styles.icon}>{priorityIcons[rec.priority]}</Text>
          <View style={styles.content}>
            <Text style={styles.title}>{rec.title}</Text>
            <Text style={styles.description}>{rec.description}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  header: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  item: {
    flexDirection: 'row-reverse',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    fontSize: 24,
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.subtitle,
    color: colors.primary,
    fontSize: 15,
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
});

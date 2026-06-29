import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Badge } from '@/src/types';
import { colors, borderRadius, spacing, typography } from '@/src/theme';

interface BadgeGridProps {
  badges: Badge[];
}

export function BadgeGrid({ badges }: BadgeGridProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.grid}>
      {badges.map((badge) => {
        const earned = !!badge.earnedAt;
        return (
          <View key={badge.id} style={[styles.badge, !earned && styles.badgeLocked]}>
            <Text style={[styles.icon, !earned && styles.iconLocked]}>{badge.icon}</Text>
            <Text style={[styles.name, !earned && styles.textLocked]}>
              {t(badge.nameKey)}
            </Text>
            <Text style={[styles.desc, !earned && styles.textLocked]}>
              {t(badge.descKey)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badge: {
    width: '47%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  badgeLocked: {
    borderColor: colors.border,
    opacity: 0.5,
  },
  icon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  iconLocked: {
    opacity: 0.4,
  },
  name: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 14,
    textAlign: 'center',
  },
  desc: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  textLocked: {
    color: colors.textMuted,
  },
});

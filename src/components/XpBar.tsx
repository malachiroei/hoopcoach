import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, borderRadius, spacing } from '@/src/theme';

interface XpBarProps {
  level: number;
  progress: number;
  totalXp: number;
}

export function XpBar({ level, progress, totalXp }: XpBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.level}>רמה {level}</Text>
        <Text style={styles.xp}>{totalXp} XP</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(progress * 100, 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  level: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  xp: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  track: {
    height: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
});

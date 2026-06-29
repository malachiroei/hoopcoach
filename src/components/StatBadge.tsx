import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@/src/theme';

interface StatBadgeProps {
  label: string;
  value: string | number;
  accent?: string;
  large?: boolean;
}

export function StatBadge({ label, value, accent = colors.primary, large }: StatBadgeProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.value, large && styles.valueLarge, { color: accent }]}>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  value: {
    ...typography.title,
    color: colors.primary,
    fontWeight: '800',
  },
  valueLarge: {
    fontSize: 42,
    fontWeight: '900',
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CourtZone } from '@/src/types';
import { colors, borderRadius } from '@/src/theme';
import { getZoneLabel } from '@/src/services/statsService';

interface ShotHeatMapProps {
  zoneStats: Record<CourtZone, { made: number; missed: number }>;
  width?: number;
  height?: number;
}

const ZONE_LAYOUT: { zone: CourtZone; x: number; y: number; w: number; h: number }[] = [
  { zone: 'cornerLeft', x: 0, y: 0, w: 0.15, h: 0.2 },
  { zone: 'threeCenter', x: 0.3, y: 0, w: 0.4, h: 0.25 },
  { zone: 'cornerRight', x: 0.85, y: 0, w: 0.15, h: 0.2 },
  { zone: 'threeLeft', x: 0, y: 0.2, w: 0.3, h: 0.3 },
  { zone: 'threeRight', x: 0.7, y: 0.2, w: 0.3, h: 0.3 },
  { zone: 'midLeft', x: 0, y: 0.5, w: 0.35, h: 0.2 },
  { zone: 'midCenter', x: 0.35, y: 0.5, w: 0.3, h: 0.2 },
  { zone: 'midRight', x: 0.65, y: 0.5, w: 0.35, h: 0.2 },
  { zone: 'paint', x: 0.35, y: 0.7, w: 0.3, h: 0.3 },
];

export function ShotHeatMap({ zoneStats, width = 300, height = 280 }: ShotHeatMapProps) {
  const { t } = useTranslation();

  return (
    <View style={[styles.container, { width, height }]}>
      <View style={styles.court}>
        {ZONE_LAYOUT.map(({ zone, x, y, w, h }) => {
          const stats = zoneStats[zone];
          const total = stats.made + stats.missed;
          const fg = total > 0 ? stats.made / total : 0;
          const bgColor = total === 0 ? colors.surfaceElevated : getHeatColor(fg);

          return (
            <View
              key={zone}
              style={[
                styles.zone,
                {
                  left: x * width,
                  top: y * height,
                  width: w * width,
                  height: h * height,
                  backgroundColor: bgColor,
                },
              ]}
            >
              {total > 0 && (
                <Text style={styles.zoneText}>
                  {Math.round(fg * 100)}%
                </Text>
              )}
            </View>
          );
        })}
        <View style={styles.hoop} />
      </View>
      <Text style={styles.legend}>{t('session.heatMap')}</Text>
    </View>
  );
}

function getHeatColor(fg: number): string {
  if (fg >= 0.7) return 'rgba(34, 197, 94, 0.7)';
  if (fg >= 0.5) return 'rgba(245, 158, 11, 0.7)';
  return 'rgba(239, 68, 68, 0.7)';
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
  },
  court: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  zone: {
    position: 'absolute',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  hoop: {
    position: 'absolute',
    top: '2%',
    left: '45%',
    width: '10%',
    height: '5%',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 4,
  },
  legend: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});

export { getZoneLabel };

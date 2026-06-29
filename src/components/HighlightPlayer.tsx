import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import type { Highlight } from '@/src/types';
import { colors, borderRadius, spacing } from '@/src/theme';

interface HighlightPlayerProps {
  highlights: Highlight[];
}

export function HighlightPlayer({ highlights }: HighlightPlayerProps) {
  const clipsWithVideo = highlights.filter((h) => h.videoPath);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(0);
  }, [highlights]);

  if (clipsWithVideo.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>🎬</Text>
        <Text style={styles.emptyLabel}>
          {highlights.length > 0
            ? `${highlights.length} מהלכים נשמרו`
            : 'אין היילייטס באימון זה'}
        </Text>
        {highlights.length > 0 && (
          <View style={styles.highlightList}>
            {highlights.map((h) => (
              <Text key={h.id} style={styles.highlightItem}>
                {getReasonLabel(h.reason)}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  }

  const current = clipsWithVideo[currentIndex];

  return (
    <View style={styles.container}>
      <Video
        source={{ uri: current.videoPath! }}
        style={styles.video}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        onPlaybackStatusUpdate={(status) => {
          if (status.isLoaded && status.didJustFinish && currentIndex < clipsWithVideo.length - 1) {
            setCurrentIndex((i) => i + 1);
          }
        }}
      />
      <Text style={styles.counter}>
        {currentIndex + 1} / {clipsWithVideo.length}
      </Text>
    </View>
  );
}

function getReasonLabel(reason: Highlight['reason']): string {
  const labels: Record<Highlight['reason'], string> = {
    made: '✅ פגיעה',
    streak: '🔥 רצף',
    longShot: '🏹 שלשה',
    manual: '📹 מהלך',
  };
  return labels[reason];
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  video: {
    width: '100%',
    height: 200,
  },
  counter: {
    color: colors.textSecondary,
    textAlign: 'center',
    padding: spacing.sm,
    fontSize: 12,
  },
  empty: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyLabel: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  highlightList: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  highlightItem: {
    color: colors.text,
    fontSize: 14,
    textAlign: 'center',
  },
});

import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ResizeMode, Video, type AVPlaybackStatus } from 'expo-av';
import type { Highlight } from '@/src/types';
import { filterPlayableHighlights } from '@/src/services/highlightService';
import { colors, borderRadius, spacing } from '@/src/theme';

interface HighlightPlayerProps {
  highlights: Highlight[];
}

export function HighlightPlayer({ highlights }: HighlightPlayerProps) {
  const videoRef = useRef<Video>(null);
  const [playableClips, setPlayableClips] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setLoading(true);
    void filterPlayableHighlights(highlights).then((clips) => {
      if (!active) {
        return;
      }
      setPlayableClips(clips);
      setCurrentIndex(0);
      setPlaybackError(null);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [highlights]);

  if (loading) {
    return (
      <View style={styles.empty}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.emptyLabel}>טוען היילייטס...</Text>
      </View>
    );
  }

  if (playableClips.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>🎬</Text>
        <Text style={styles.emptyLabel}>
          {highlights.length > 0
            ? 'אין קטעי וידאו תקינים — היילייטס נשמרים רק בפגיעות עם הקלטה מלאה'
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

  const current = playableClips[currentIndex];

  const handlePlaybackUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        setPlaybackError('לא ניתן להפעיל את הסרטון');
      }
      return;
    }

    if (status.didJustFinish && currentIndex < playableClips.length - 1) {
      setCurrentIndex((index) => index + 1);
      setPlaybackError(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.reelTitle}>סרטון היילייטס</Text>
      <Video
        key={current.videoPath}
        ref={videoRef}
        source={{ uri: current.videoPath! }}
        style={styles.video}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        isLooping={false}
        onPlaybackStatusUpdate={handlePlaybackUpdate}
        onError={() => setPlaybackError('שגיאה בהפעלת הווידאו')}
      />
      {playbackError && <Text style={styles.errorText}>{playbackError}</Text>}
      <View style={styles.controlsRow}>
        <Pressable
          style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
          disabled={currentIndex === 0}
          onPress={() => setCurrentIndex((index) => Math.max(0, index - 1))}
        >
          <Text style={styles.navButtonText}>הקודם</Text>
        </Pressable>
        <Text style={styles.counter}>
          {currentIndex + 1} / {playableClips.length}
        </Text>
        <Pressable
          style={[
            styles.navButton,
            currentIndex >= playableClips.length - 1 && styles.navButtonDisabled,
          ]}
          disabled={currentIndex >= playableClips.length - 1}
          onPress={() =>
            setCurrentIndex((index) => Math.min(playableClips.length - 1, index + 1))
          }
        >
          <Text style={styles.navButtonText}>הבא</Text>
        </Pressable>
      </View>
      <Text style={styles.reasonText}>{getReasonLabel(current.reason)}</Text>
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
    height: 220,
    backgroundColor: '#000',
  },
  reelTitle: {
    color: colors.text,
    fontSize: 14,
    fontFamily: 'Rubik_700Bold',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  controlsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  counter: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: 'Rubik_600SemiBold',
  },
  navButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    color: colors.text,
    fontSize: 12,
    fontFamily: 'Rubik_600SemiBold',
  },
  reasonText: {
    color: colors.textSecondary,
    textAlign: 'center',
    padding: spacing.sm,
    fontSize: 12,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    fontSize: 12,
    fontFamily: 'Rubik_600SemiBold',
  },
  empty: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 40,
  },
  emptyLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'Rubik_400Regular',
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

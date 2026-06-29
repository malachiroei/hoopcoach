import React, { useRef, useState } from 'react';
import { StyleSheet, View, Pressable, Dimensions } from 'react-native';
import type { Point2D } from '@/src/types';
import { colors } from '@/src/theme';

interface CourtCalibrationViewProps {
  onComplete: (points: Point2D[]) => void;
  initialPoints?: Point2D[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COURT_WIDTH = SCREEN_WIDTH - 48;
const COURT_HEIGHT = COURT_WIDTH * 0.9;

const POINT_LABELS = ['שמאל-קשת', 'ימין-קשת', 'שמאל-קו', 'ימין-קו'];

export function CourtCalibrationView({ onComplete, initialPoints = [] }: CourtCalibrationViewProps) {
  const [points, setPoints] = useState<Point2D[]>(initialPoints);

  const handlePress = (event: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (points.length >= 4) return;

    const newPoint: Point2D = {
      x: event.nativeEvent.locationX / COURT_WIDTH,
      y: event.nativeEvent.locationY / COURT_HEIGHT,
    };

    const updated = [...points, newPoint];
    setPoints(updated);

    if (updated.length === 4) {
      onComplete(updated);
    }
  };

  return (
    <Pressable onPress={handlePress} style={styles.container}>
      <View style={[styles.court, { width: COURT_WIDTH, height: COURT_HEIGHT }]}>
        <View style={styles.threePointArc} />
        <View style={styles.paint} />
        <View style={styles.hoop} />

        {points.map((point, index) => (
          <View
            key={index}
            style={[
              styles.marker,
              {
                left: point.x * COURT_WIDTH - 12,
                top: point.y * COURT_HEIGHT - 12,
              },
            ]}
          />
        ))}
      </View>
    </Pressable>
  );
}

export function getCalibrationLabels(): string[] {
  return POINT_LABELS;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  court: {
    backgroundColor: '#1a472a',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
  },
  threePointArc: {
    position: 'absolute',
    top: '5%',
    left: '10%',
    right: '10%',
    height: '40%',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    borderBottomWidth: 0,
    borderTopLeftRadius: 200,
    borderTopRightRadius: 200,
  },
  paint: {
    position: 'absolute',
    bottom: 0,
    left: '35%',
    width: '30%',
    height: '25%',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    borderBottomWidth: 0,
  },
  hoop: {
    position: 'absolute',
    top: '8%',
    left: '46%',
    width: '8%',
    height: '4%',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 2,
  },
  marker: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.text,
  },
});

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Text,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import type { Point2D } from '@/src/types';
import { colors } from '@/src/theme';

interface CourtCalibrationViewProps {
  onComplete: (points: Point2D[]) => void;
  initialPoints?: Point2D[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COURT_WIDTH = SCREEN_WIDTH - 48;
const COURT_HEIGHT = COURT_WIDTH * 0.9;
const MARKER_SIZE = 24;
const MARKER_HALF = MARKER_SIZE / 2;

const POINT_LABELS = ['שמאל-קשת', 'ימין-קשת', 'שמאל-קו', 'ימין-קו'];

export function CourtCalibrationView({ onComplete, initialPoints = [] }: CourtCalibrationViewProps) {
  const [points, setPoints] = useState<Point2D[]>(initialPoints);
  const [layout, setLayout] = useState({ width: COURT_WIDTH, height: COURT_HEIGHT });
  const device = useCameraDevice('back');

  const handleCourtLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setLayout({ width, height });
    }
  };

  const handlePress = (event: GestureResponderEvent) => {
    if (points.length >= 4) return;

    const { locationX, locationY } = event.nativeEvent;
    const { width, height } = layout;
    if (width <= 0 || height <= 0) return;

    const newPoint: Point2D = {
      x: Math.min(Math.max(locationX / width, 0), 1),
      y: Math.min(Math.max(locationY / height, 0), 1),
    };

    const updated = [...points, newPoint];
    setPoints(updated);

    if (updated.length === 4) {
      onComplete(updated);
    }
  };

  const markerPosition = (point: Point2D) => ({
    left: point.x * layout.width - MARKER_HALF,
    top: point.y * layout.height - MARKER_HALF,
  });

  return (
    <View style={styles.container}>
      <View
        style={[styles.court, { width: COURT_WIDTH, height: COURT_HEIGHT }]}
        onLayout={handleCourtLayout}
      >
        {device ? (
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive
            video
            audio={false}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.cameraLoading]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>מחפש מצלמה...</Text>
          </View>
        )}

        <View style={styles.guideOverlay} pointerEvents="none">
          <View style={styles.threePointArc} />
          <View style={styles.paint} />
          <View style={styles.hoop} />
        </View>

        {points.map((point, index) => (
          <View
            key={index}
            pointerEvents="none"
            style={[styles.marker, markerPosition(point)]}
          />
        ))}

        <Pressable style={StyleSheet.absoluteFill} onPress={handlePress} />
      </View>
    </View>
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
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
    direction: 'ltr',
  },
  cameraLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    gap: 8,
  },
  loadingText: {
    color: colors.textSecondary,
    fontFamily: 'Rubik_400Regular',
    fontSize: 14,
  },
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  threePointArc: {
    position: 'absolute',
    top: '5%',
    left: '10%',
    right: '10%',
    height: '40%',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
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
    borderColor: 'rgba(255,255,255,0.45)',
    borderBottomWidth: 0,
  },
  hoop: {
    position: 'absolute',
    top: '8%',
    left: '46%',
    width: '8%',
    height: '4%',
    borderWidth: 2,
    borderColor: 'rgba(255, 165, 0, 0.7)',
    borderRadius: 2,
  },
  marker: {
    position: 'absolute',
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_HALF,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.text,
  },
});

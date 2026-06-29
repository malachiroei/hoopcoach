import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DetectionBox } from '@/src/types';
import { colors } from '@/src/theme';

interface DetectionOverlayProps {
  detections: DetectionBox[];
  frameWidth: number;
  frameHeight: number;
  displayWidth: number;
  displayHeight: number;
}

const CLASS_COLORS: Record<DetectionBox['classId'], string> = {
  ball: colors.primary,
  hoop: colors.accent,
  ballInBasket: colors.success,
  player: '#8B5CF6',
};

export function DetectionOverlay({
  detections,
  frameWidth,
  frameHeight,
  displayWidth,
  displayHeight,
}: DetectionOverlayProps) {
  const scaleX = displayWidth / frameWidth;
  const scaleY = displayHeight / frameHeight;

  return (
    <View style={[styles.container, { width: displayWidth, height: displayHeight }]} pointerEvents="none">
      {detections.map((det, i) => (
        <View
          key={`${det.classId}-${i}`}
          style={[
            styles.box,
            {
              left: det.x * scaleX,
              top: det.y * scaleY,
              width: det.width * scaleX,
              height: det.height * scaleY,
              borderColor: CLASS_COLORS[det.classId],
            },
          ]}
        >
          <Text style={[styles.label, { backgroundColor: CLASS_COLORS[det.classId] }]}>
            {det.classId} {(det.confidence * 100).toFixed(0)}%
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  box: {
    position: 'absolute',
    borderWidth: 2,
  },
  label: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 4,
    paddingVertical: 1,
    position: 'absolute',
    top: -14,
    left: 0,
  },
});

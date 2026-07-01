import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Orientation } from 'react-native-vision-camera';
import type { DetectionBox } from '@/src/types';
import { mapDetectionBoxToScreen } from '@/src/cv/coordinateMapping';
import { colors } from '@/src/theme';

interface DetectionOverlayProps {
  detections: DetectionBox[];
  frameWidth: number;
  frameHeight: number;
  displayWidth: number;
  displayHeight: number;
  orientation?: Orientation;
  isMirrored?: boolean;
}

const CLASS_COLORS: Record<DetectionBox['classId'], string> = {
  ball: '#FF6B00',
  hoop: '#00D4AA',
  ballInBasket: '#22C55E',
  player: '#8B5CF6',
};

/** Classes shown on the debug overlay (hide rare false-positive ballInBasket). */
const OVERLAY_CLASSES = new Set<DetectionBox['classId']>(['ball', 'hoop', 'player']);

export function DetectionOverlay({
  detections,
  frameWidth,
  frameHeight,
  displayWidth,
  displayHeight,
  orientation = 'portrait',
  isMirrored = false,
}: DetectionOverlayProps) {
  const frameLayout = {
    frameWidth,
    frameHeight,
    displayWidth,
    displayHeight,
    orientation,
    isMirrored,
  };

  const visibleDetections = detections.filter((d) => OVERLAY_CLASSES.has(d.classId));

  return (
    <View
      style={[styles.container, { width: displayWidth, height: displayHeight }]}
      pointerEvents="box-none"
    >
      {__DEV__ && (
        <View style={styles.debugHud} pointerEvents="none">
          <Text style={styles.debugHudText}>
            overlay boxes: {visibleDetections.length}/{detections.length} | screen {displayWidth.toFixed(0)}x
            {displayHeight.toFixed(0)} {displayWidth > displayHeight ? 'LAND' : 'PORT'}
          </Text>
          <Text style={styles.debugHudText}>
            frame {frameWidth}x{frameHeight} {orientation}
          </Text>
          {visibleDetections.length > 0 && (
            <Text style={styles.debugHudText}>
              {visibleDetections.map((d) => `${d.classId} ${(d.confidence * 100).toFixed(0)}%`).join(' · ')}
            </Text>
          )}
        </View>
      )}

      {visibleDetections.map((det, i) => {
        const screenBox = mapDetectionBoxToScreen(det, frameLayout);
        const borderColor = CLASS_COLORS[det.classId];

        return (
          <View
            key={`${det.classId}-${i}`}
            pointerEvents="none"
            style={[
              styles.box,
              {
                left: screenBox.left,
                top: screenBox.top,
                width: Math.max(screenBox.width, 8),
                height: Math.max(screenBox.height, 8),
                borderColor,
                backgroundColor: `${borderColor}33`,
              },
            ]}
          >
            <Text style={[styles.label, { backgroundColor: borderColor }]}>
              {det.classId} {(det.confidence * 100).toFixed(0)}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    direction: 'ltr',
    zIndex: 20,
    elevation: 20,
  },
  debugHud: {
    position: 'absolute',
    top: 140,
    left: 12,
    right: 12,
    direction: 'ltr',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 30,
    elevation: 30,
  },
  debugHudText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  box: {
    position: 'absolute',
    borderWidth: 3,
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

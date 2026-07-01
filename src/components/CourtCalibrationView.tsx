import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Dimensions,
  Text,
  Pressable,
  ActivityIndicator,
  I18nManager,
  type LayoutChangeEvent,
  type GestureResponderEvent,
} from 'react-native';
import { useCameraDevice } from 'react-native-vision-camera';
import { useIsFocused } from '@react-navigation/native';
import { PreviewCamera } from '@/src/components/PreviewCamera';
import { BasketballHalfCourtOverlay } from '@/src/components/BasketballHalfCourtOverlay';
import type { Point2D } from '@/src/types';
import { colors } from '@/src/theme';

export interface CourtSize {
  width: number;
  height: number;
}

interface CourtCalibrationViewProps {
  onComplete: (points: Point2D[]) => void;
  initialPoints?: Point2D[];
  onPointsChange?: (count: number) => void;
  onPointsUpdate?: (points: Point2D[]) => void;
  onCourtSizeChange?: (size: CourtSize) => void;
  cameraEnabled?: boolean;
}

const MARKER_SIZE = 28;
const MARKER_HALF = MARKER_SIZE / 2;

const POINT_LABELS = ['שמאל-קשת', 'ימין-קשת', 'שמאל-קו', 'ימין-קו'];

const FALLBACK_SCREEN_WIDTH = 360;

const ltrLayout = {
  direction: 'ltr' as const,
};

function touchToNormalized(locationX: number, locationY: number, width: number, height: number): Point2D {
  return {
    x: Math.min(Math.max(locationX / width, 0), 1),
    y: Math.min(Math.max(locationY / height, 0), 1),
  };
}

export function markerOffset(point: Point2D, width: number, height: number) {
  const visualX = I18nManager.isRTL ? 1 - point.x : point.x;
  return {
    left: visualX * width - MARKER_HALF,
    top: point.y * height - MARKER_HALF,
  };
}

export function getCourtBounds() {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const safeWidth = screenWidth > 0 ? screenWidth : FALLBACK_SCREEN_WIDTH;
  const safeHeight = screenHeight > 0 ? screenHeight : 640;
  const width = Math.max(safeWidth - 48, 280);
  const height = Math.min(width * 0.9, safeHeight * 0.34);
  return { width, height: Math.max(height, 248) };
}

export function CourtCalibrationView({
  onComplete,
  initialPoints = [],
  onPointsChange,
  onPointsUpdate,
  onCourtSizeChange,
  cameraEnabled = true,
}: CourtCalibrationViewProps) {
  const [points, setPoints] = useState<Point2D[]>(initialPoints);
  const completedRef = useRef(false);
  const courtRef = useRef<View>(null);
  const courtSizeRef = useRef<CourtSize>(getCourtBounds());
  const courtBounds = getCourtBounds();
  const device = useCameraDevice('back');
  const isFocused = useIsFocused();
  const showCamera = cameraEnabled && device != null;

  const handleCourtLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      if (width <= 0 || height <= 0) return;
      const size = { width, height };
      courtSizeRef.current = size;
      onCourtSizeChange?.(size);
    },
    [onCourtSizeChange]
  );

  useEffect(() => {
    onPointsChange?.(points.length);
    onPointsUpdate?.(points);
  }, [points, onPointsChange, onPointsUpdate]);

  useEffect(() => {
    if (points.length < 4) {
      completedRef.current = false;
      return;
    }
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete(points);
  }, [points, onComplete]);

  const handlePress = useCallback((event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    const { width, height } = courtSizeRef.current;
    if (width <= 0 || height <= 0) return;

    courtRef.current?.measureInWindow((winX, winY, measuredWidth, measuredHeight) => {
      const w = measuredWidth > 0 ? measuredWidth : width;
      const h = measuredHeight > 0 ? measuredHeight : height;
      const localX = pageX - winX;
      const localY = pageY - winY;
      const newPoint = touchToNormalized(localX, localY, w, h);

      setPoints((prev) => {
        if (prev.length >= 4) return prev;
        return [...prev, newPoint];
      });
    });
  }, []);

  const resetPoints = useCallback(() => {
    completedRef.current = false;
    setPoints([]);
  }, []);

  return (
    <View
      ref={courtRef}
      collapsable={false}
      onLayout={handleCourtLayout}
      style={[
        styles.court,
        { width: courtBounds.width, height: courtBounds.height },
      ]}
    >
      <View style={styles.cameraLayer} pointerEvents="none">
        {showCamera ? (
          <PreviewCamera device={device} isActive={isFocused} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.cameraLoading]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>מחפש מצלמה...</Text>
          </View>
        )}
      </View>

      <View style={styles.guideLayer} pointerEvents="none">
        <BasketballHalfCourtOverlay opaque={!showCamera} />
      </View>

      <Pressable
        style={styles.touchLayer}
        onPress={handlePress}
        onLongPress={resetPoints}
        delayLongPress={500}
        android_disableSound
      />
    </View>
  );
}

export function CalibrationMarkersOverlay({
  points,
  width,
  height,
}: {
  points: Point2D[];
  width: number;
  height: number;
}) {
  if (width <= 0 || height <= 0) return null;

  return (
    <View
      collapsable={false}
      pointerEvents="none"
      style={[styles.markersOverlay, { width, height }]}
    >
      {points.map((point, index) => {
        const offset = markerOffset(point, width, height);
        return (
          <View
            key={`marker-${index}`}
            style={[styles.markerWrap, { left: offset.left, top: offset.top }]}
          >
            <View style={styles.markerRing} />
            <Text style={styles.markerIndex}>{index + 1}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function getCalibrationLabels(): string[] {
  return POINT_LABELS;
}

const styles = StyleSheet.create({
  court: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    ...ltrLayout,
  },
  cameraLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    ...ltrLayout,
  },
  guideLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    ...ltrLayout,
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
  touchLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    ...ltrLayout,
  },
  markersOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 10000,
    elevation: 10000,
    ...ltrLayout,
  },
  markerWrap: {
    position: 'absolute',
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerRing: {
    position: 'absolute',
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_HALF,
    borderWidth: 3,
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 107, 0, 0.15)',
  },
  markerIndex: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Rubik_700Bold',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

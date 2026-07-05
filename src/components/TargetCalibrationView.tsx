import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { mapDisplayPointToNormalized, mapNormalizedCenterToDisplay } from '@/src/cv/coordinateMapping';
import { Button } from '@/src/components/Button';
import type { TargetAnchor } from '@/src/types';
import { colors, spacing, typography } from '@/src/theme';

const LTR = { direction: 'ltr' as const };

interface TargetCalibrationViewProps {
  imageUri: string;
  frameWidth: number;
  frameHeight: number;
  displayWidth: number;
  displayHeight: number;
  initialBall: TargetAnchor;
  initialHoop: TargetAnchor;
  scanning?: boolean;
  onConfirm: (
    ball: TargetAnchor,
    hoop: TargetAnchor,
    displayBall: TargetAnchor,
    displayHoop: TargetAnchor,
  ) => void;
  onRetake: () => void;
}

interface DisplayAnchor {
  cx: number;
  cy: number;
  size: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function imageAnchorToDisplay(
  anchor: TargetAnchor,
  frameWidth: number,
  frameHeight: number,
  displayWidth: number,
  displayHeight: number,
): DisplayAnchor {
  if (frameWidth > 0 && frameHeight > 0 && displayWidth > 0 && displayHeight > 0) {
    const center = mapNormalizedCenterToDisplay(
      anchor.cx,
      anchor.cy,
      anchor.size,
      frameWidth,
      frameHeight,
      displayWidth,
      displayHeight,
    );
    return {
      cx: center.left / displayWidth,
      cy: center.top / displayHeight,
      size: anchor.size,
    };
  }

  return { cx: anchor.cx, cy: anchor.cy, size: anchor.size };
}

function displayAnchorToImage(
  anchor: DisplayAnchor,
  frameWidth: number,
  frameHeight: number,
  displayWidth: number,
  displayHeight: number,
): TargetAnchor {
  if (frameWidth > 0 && frameHeight > 0 && displayWidth > 0 && displayHeight > 0) {
    const normalized = mapDisplayPointToNormalized(
      anchor.cx * displayWidth,
      anchor.cy * displayHeight,
      frameWidth,
      frameHeight,
      displayWidth,
      displayHeight,
    );
    return { cx: normalized.x, cy: normalized.y, size: anchor.size };
  }

  return { cx: anchor.cx, cy: anchor.cy, size: anchor.size };
}

interface DraggableMarkerProps {
  label: string;
  anchor: DisplayAnchor;
  markerSize: number;
  color: string;
  shape: 'circle' | 'square';
  displayWidth: number;
  displayHeight: number;
  onMove: (cx: number, cy: number) => void;
}

function DraggableMarker({
  label,
  anchor,
  markerSize,
  color,
  shape,
  displayWidth,
  displayHeight,
  onMove,
}: DraggableMarkerProps) {
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;

  const dragOrigin = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragOrigin.current = {
          x: anchorRef.current.cx * displayWidth,
          y: anchorRef.current.cy * displayHeight,
        };
      },
      onPanResponderMove: (_, gesture) => {
        const px = dragOrigin.current.x + gesture.dx;
        const py = dragOrigin.current.y + gesture.dy;
        onMove(clamp01(px / displayWidth), clamp01(py / displayHeight));
      },
      onPanResponderRelease: (_, gesture) => {
        const px = dragOrigin.current.x + gesture.dx;
        const py = dragOrigin.current.y + gesture.dy;
        onMove(clamp01(px / displayWidth), clamp01(py / displayHeight));
      },
    }),
  ).current;

  const left = anchor.cx * displayWidth - markerSize / 2;
  const top = anchor.cy * displayHeight - markerSize / 2;

  return (
    <View
      {...panResponder.panHandlers}
      style={[
        styles.markerWrap,
        {
          left,
          top,
          width: markerSize,
          height: markerSize,
        },
      ]}
    >
      <Text style={styles.markerLabel}>{label}</Text>
      <View
        style={[
          shape === 'circle' ? styles.circle : styles.square,
          {
            width: markerSize,
            height: markerSize,
            borderColor: color,
            backgroundColor: shape === 'circle' ? 'rgba(255,140,0,0.2)' : 'rgba(34,197,94,0.15)',
            borderRadius: shape === 'circle' ? markerSize / 2 : 4,
          },
        ]}
      />
    </View>
  );
}

export function TargetCalibrationView({
  imageUri,
  frameWidth,
  frameHeight,
  displayWidth,
  displayHeight,
  initialBall,
  initialHoop,
  scanning = false,
  onConfirm,
  onRetake,
}: TargetCalibrationViewProps) {
  const [ball, setBall] = useState<DisplayAnchor>(() =>
    imageAnchorToDisplay(initialBall, frameWidth, frameHeight, displayWidth, displayHeight),
  );
  const [hoop, setHoop] = useState<DisplayAnchor>(() =>
    imageAnchorToDisplay(initialHoop, frameWidth, frameHeight, displayWidth, displayHeight),
  );

  useEffect(() => {
    setBall(imageAnchorToDisplay(initialBall, frameWidth, frameHeight, displayWidth, displayHeight));
    setHoop(imageAnchorToDisplay(initialHoop, frameWidth, frameHeight, displayWidth, displayHeight));
  }, [displayHeight, displayWidth, frameHeight, frameWidth, initialBall, initialHoop]);

  const handleBallMove = useCallback((cx: number, cy: number) => {
    setBall((prev) => ({ ...prev, cx, cy }));
  }, []);

  const handleHoopMove = useCallback((cx: number, cy: number) => {
    setHoop((prev) => ({ ...prev, cx, cy }));
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(
      displayAnchorToImage(ball, frameWidth, frameHeight, displayWidth, displayHeight),
      displayAnchorToImage(hoop, frameWidth, frameHeight, displayWidth, displayHeight),
      { cx: ball.cx, cy: ball.cy, size: ball.size },
      { cx: hoop.cx, cy: hoop.cy, size: hoop.size },
    );
  }, [ball, displayHeight, displayWidth, frameHeight, frameWidth, hoop, onConfirm]);

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: imageUri }}
        style={{ width: displayWidth, height: displayHeight, direction: 'ltr' }}
        resizeMode="cover"
      />

      <View style={[styles.overlay, LTR]} pointerEvents="box-none">
        {scanning ? (
          <View style={styles.scanOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.scanText}>מזהה סל וכדור...</Text>
          </View>
        ) : (
          <>
            <DraggableMarker
              label="סל"
              anchor={hoop}
              markerSize={72}
              color="#22C55E"
              shape="square"
              displayWidth={displayWidth}
              displayHeight={displayHeight}
              onMove={handleHoopMove}
            />
            <DraggableMarker
              label="כדור"
              anchor={ball}
              markerSize={48}
              color="#FF8C00"
              shape="circle"
              displayWidth={displayWidth}
              displayHeight={displayHeight}
              onMove={handleBallMove}
            />

            <View style={styles.instructions}>
              <Text style={styles.instructionTitle}>בדוק את הזיהוי</Text>
              <Text style={styles.instructionText}>
                גרור את הריבוע הירוק לסל (לוח + טבעת) ואת העיגול הכתום לכדור
              </Text>
            </View>

            <View style={styles.actions}>
              <Button title="צלם מחדש" onPress={onRetake} variant="secondary" />
              <Button title="אשר והתחל אימון" onPress={handleConfirm} size="lg" />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  scanText: {
    color: colors.text,
    fontFamily: 'Rubik_600SemiBold',
    fontSize: 16,
  },
  markerWrap: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 20,
  },
  markerLabel: {
    position: 'absolute',
    top: -22,
    color: '#fff',
    fontFamily: 'Rubik_700Bold',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 21,
  },
  circle: {
    borderWidth: 3,
  },
  square: {
    borderWidth: 3,
  },
  instructions: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 12,
    padding: spacing.md,
    zIndex: 15,
  },
  instructionTitle: {
    ...typography.title,
    color: colors.text,
    fontFamily: 'Rubik_700Bold',
    fontSize: 16,
    textAlign: 'right',
    marginBottom: 4,
  },
  instructionText: {
    color: colors.textSecondary,
    fontFamily: 'Rubik_400Regular',
    fontSize: 14,
    textAlign: 'right',
    lineHeight: 20,
  },
  actions: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    zIndex: 15,
  },
});

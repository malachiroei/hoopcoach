import { StyleSheet, Text, View } from 'react-native';
import { mapDetectionBoxToScreen } from '@/src/cv/coordinateMapping';
import type { CameraFrameLayout } from '@/src/cv/coordinateMapping';
import type { DetectionBox } from '@/src/types';
import { colors } from '@/src/theme';

interface LocalDetectionOverlayProps {
  detections: DetectionBox[];
  frameWidth: number;
  frameHeight: number;
  displayWidth: number;
  displayHeight: number;
  orientation?: CameraFrameLayout['orientation'];
  isMirrored?: boolean;
  showDebug?: boolean;
  previewMode?: boolean;
}

const CLASS_COLORS: Record<DetectionBox['classId'], string> = {
  ball: '#FF8C00',
  hoop: '#22C55E',
  ballInBasket: '#22C55E',
  player: '#60A5FA',
};

const OVERLAY_CLASSES = new Set<DetectionBox['classId']>(['ball', 'hoop', 'player']);

export function LocalDetectionOverlay({
  detections,
  frameWidth,
  frameHeight,
  displayWidth,
  displayHeight,
  orientation = 'landscape-left',
  isMirrored = false,
  showDebug = false,
  previewMode = false,
}: LocalDetectionOverlayProps) {
  if (displayWidth <= 0 || displayHeight <= 0) {
    return null;
  }

  const layout: CameraFrameLayout = {
    frameWidth,
    frameHeight,
    displayWidth,
    displayHeight,
    orientation,
    isMirrored,
  };

  const visible = detections.filter((d) => OVERLAY_CLASSES.has(d.classId));
  const ball = visible.find((d) => d.classId === 'ball');
  const hoop = visible.find((d) => d.classId === 'hoop');
  const players = visible.filter((d) => d.classId === 'player');

  const ballRect = ball ? mapDetectionBoxToScreen(ball, layout) : null;
  const hoopRect = hoop ? mapDetectionBoxToScreen(hoop, layout) : null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]} pointerEvents="none">
      {hoopRect && (
        <Marker
          label="סל"
          color={CLASS_COLORS.hoop}
          shape="square"
          rect={hoopRect}
        />
      )}

      {ballRect && (
        <Marker
          label="כדור"
          color={CLASS_COLORS.ball}
          shape="circle"
          rect={ballRect}
        />
      )}

      {!previewMode &&
        players.slice(0, 6).map((player, index) => {
          const rect = mapDetectionBoxToScreen(player, layout);
          return (
            <View
              key={`player-${index}-${Math.round(rect.left)}`}
              style={[
                styles.playerBox,
                {
                  left: rect.left,
                  top: rect.top,
                  width: Math.max(rect.width, 36),
                  height: Math.max(rect.height, 48),
                },
              ]}
            />
          );
        })}

      <View style={styles.statusPill}>
        <Text style={styles.statusText}>
          {previewMode
            ? ballRect
              ? 'זיהוי מקומי פעיל'
              : 'מחפש כדור (COCO sports ball)...'
            : ballRect && hoopRect
              ? 'מעקב מקומי'
              : ballRect
                ? 'כדור ✓'
                : 'מחפש...'}
        </Text>
        {showDebug && (
          <Text style={styles.debugText}>
            frame {frameWidth}x{frameHeight} | boxes {visible.length}
          </Text>
        )}
      </View>
    </View>
  );
}

function Marker({
  label,
  color,
  shape,
  rect,
}: {
  label: string;
  color: string;
  shape: 'circle' | 'square';
  rect: { left: number; top: number; width: number; height: number };
}) {
  const size = Math.max(rect.width, rect.height, shape === 'circle' ? 28 : 44);
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  return (
    <View
      style={[
        styles.markerWrap,
        { left: cx - size / 2, top: cy - size / 2, width: size, height: size },
      ]}
    >
      <Text style={styles.markerLabel}>{label}</Text>
      <View
        style={[
          shape === 'circle' ? styles.circle : styles.square,
          {
            width: size,
            height: size,
            borderRadius: shape === 'circle' ? size / 2 : 4,
            borderColor: color,
            backgroundColor: shape === 'circle' ? 'rgba(255,140,0,0.25)' : 'rgba(34,197,94,0.18)',
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    direction: 'ltr',
    zIndex: 20,
    elevation: 20,
  },
  markerWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  circle: {
    borderWidth: 3,
  },
  square: {
    borderWidth: 3,
  },
  playerBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#60A5FA',
    borderStyle: 'dashed',
    borderRadius: 4,
    backgroundColor: 'rgba(96,165,250,0.12)',
  },
  statusPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    maxWidth: '55%',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  statusText: {
    color: colors.text,
    fontFamily: 'Rubik_700Bold',
    fontSize: 14,
    textAlign: 'right',
  },
  debugText: {
    color: colors.textSecondary,
    fontFamily: 'Rubik_400Regular',
    fontSize: 11,
    textAlign: 'right',
  },
});

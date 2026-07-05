import { StyleSheet, Text, View } from 'react-native';
import { mapNormalizedBoxToCoverDisplay } from '@/src/cv/coordinateMapping';
import type { CloudNormalizedBox, CloudPlayerBox, DetectShotResponse } from '@/src/services/detectShotService';
import { colors } from '@/src/theme';

interface DetectionOverlayProps {
  cloudDetection: DetectShotResponse | null;
  /** Last known positions — markers stay visible between API frames. */
  stickyBallBox?: CloudNormalizedBox | null;
  stickyHoopBox?: CloudNormalizedBox | null;
  displayWidth: number;
  displayHeight: number;
  frameWidth: number;
  frameHeight: number;
  showDebug?: boolean;
  /** Preview/setup — simpler status, always show markers when available. */
  previewMode?: boolean;
}

function boxToScreenRect(
  box: CloudNormalizedBox,
  frameWidth: number,
  frameHeight: number,
  displayWidth: number,
  displayHeight: number,
) {
  if (frameWidth > 0 && frameHeight > 0) {
    return mapNormalizedBoxToCoverDisplay(box, frameWidth, frameHeight, displayWidth, displayHeight);
  }
  return {
    left: box.x * displayWidth,
    top: box.y * displayHeight,
    width: Math.max(box.width * displayWidth, 24),
    height: Math.max(box.height * displayHeight, 24),
  };
}

function BallMarker({
  rect,
  label = 'כדור',
}: {
  rect: { left: number; top: number; width: number; height: number };
  label?: string;
}) {
  const size = Math.max(rect.width, rect.height, 28);
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.markerWrap,
        {
          left: cx - size / 2,
          top: cy - size / 2,
          width: size,
          height: size,
        },
      ]}
    >
      <Text style={styles.markerLabel}>{label}</Text>
      <View
        style={[
          styles.ballCircle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      />
    </View>
  );
}

function HoopMarker({
  rect,
  label = 'סל',
}: {
  rect: { left: number; top: number; width: number; height: number };
  label?: string;
}) {
  const size = Math.max(rect.width, rect.height, 44);
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.markerWrap,
        {
          left: cx - size / 2,
          top: cy - size / 2,
          width: size,
          height: size,
        },
      ]}
    >
      <Text style={styles.markerLabel}>{label}</Text>
      <View
        style={[
          styles.hoopSquare,
          {
            width: size,
            height: size,
          },
        ]}
      />
    </View>
  );
}

function PlayerMarker({
  player,
  frameWidth,
  frameHeight,
  displayWidth,
  displayHeight,
}: {
  player: CloudPlayerBox;
  frameWidth: number;
  frameHeight: number;
  displayWidth: number;
  displayHeight: number;
}) {
  const rect = boxToScreenRect(player.box, frameWidth, frameHeight, displayWidth, displayHeight);
  const label = `שחקן ${player.index}`;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.playerWrap,
        {
          left: rect.left,
          top: rect.top,
          width: Math.max(rect.width, 40),
          height: Math.max(rect.height, 50),
        },
      ]}
    >
      <Text style={styles.playerLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.playerBox} />
    </View>
  );
}

export function DetectionOverlay({
  cloudDetection,
  stickyBallBox = null,
  stickyHoopBox = null,
  displayWidth,
  displayHeight,
  frameWidth,
  frameHeight,
  showDebug = false,
  previewMode = false,
}: DetectionOverlayProps) {
  if (displayWidth <= 0 || displayHeight <= 0) {
    return null;
  }

  const liveBallBox = cloudDetection?.ballBox ?? null;
  const liveHoopBox = cloudDetection?.hoopBox ?? null;
  const ballBox = liveBallBox ?? stickyBallBox;
  const hoopBox = liveHoopBox ?? stickyHoopBox;
  const livePlayers = cloudDetection?.players ?? [];
  const hasLivePlayers = livePlayers.length > 0;

  const ballRect = ballBox
    ? boxToScreenRect(ballBox, frameWidth, frameHeight, displayWidth, displayHeight)
    : null;

  const hoopRect = hoopBox
    ? boxToScreenRect(hoopBox, frameWidth, frameHeight, displayWidth, displayHeight)
    : null;

  const statusText = previewMode
    ? ballRect && hoopRect
      ? 'זיהוי פעיל — גרור לכיוון או צלם לאישור'
      : ballRect || hoopRect
        ? 'מזהה...'
        : 'מחפש כדור וסל...'
    : cloudDetection?.shotActive
      ? cloudDetection.event === 'shot_made'
        ? '✅ סל!'
        : cloudDetection.event === 'shot_missed'
          ? '❌ החטאה'
          : '🏀 זריקה'
      : ballRect
        ? 'מזהה כדור'
        : 'מחפש כדור...';

  return (
    <View style={[StyleSheet.absoluteFill, { direction: 'ltr' }]} pointerEvents="none">
      {hoopRect && <HoopMarker rect={hoopRect} />}

      {ballRect && <BallMarker rect={ballRect} />}

      {!previewMode &&
        livePlayers.map((player) => (
          <PlayerMarker
            key={`p${player.index}-${Math.round(player.box.x * 10000)}-${Math.round(player.box.y * 10000)}`}
            player={player}
            frameWidth={frameWidth}
            frameHeight={frameHeight}
            displayWidth={displayWidth}
            displayHeight={displayHeight}
          />
        ))}

      <View style={styles.statusPill}>
        <Text style={styles.statusText}>{statusText}</Text>
        <View style={styles.detectionRow}>
          <Text style={[styles.detectionChip, ballRect ? styles.chipOn : styles.chipOff]}>
            כדור {ballRect ? '✓' : '—'}
          </Text>
          <Text style={[styles.detectionChip, hoopRect ? styles.chipOn : styles.chipOff]}>
            סל {hoopRect ? '✓' : '—'}
          </Text>
          {!previewMode && (
            <Text style={[styles.detectionChip, hasLivePlayers ? styles.chipOn : styles.chipOff]}>
              שחקנים {hasLivePlayers ? livePlayers.length : '—'}
            </Text>
          )}
        </View>
        {showDebug && cloudDetection?.observation && (
          <Text style={styles.debugText} numberOfLines={2}>
            {cloudDetection.observation}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  markerWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
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
    zIndex: 26,
  },
  ballCircle: {
    borderWidth: 3,
    borderColor: '#FF8C00',
    backgroundColor: 'rgba(255, 140, 0, 0.3)',
  },
  hoopSquare: {
    borderWidth: 3,
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: 4,
  },
  playerWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  playerLabel: {
    color: '#fff',
    fontFamily: 'Rubik_700Bold',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 2,
    minWidth: 72,
    textAlign: 'center',
    overflow: 'hidden',
  },
  playerBox: {
    flex: 1,
    width: '100%',
    borderWidth: 2,
    borderColor: '#60A5FA',
    borderStyle: 'dashed',
    borderRadius: 4,
    minHeight: 40,
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
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
    fontSize: 15,
    textAlign: 'right',
  },
  detectionRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  detectionChip: {
    fontFamily: 'Rubik_600SemiBold',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  chipOn: {
    color: '#86EFAC',
    backgroundColor: 'rgba(34,197,94,0.25)',
  },
  chipOff: {
    color: '#FCA5A5',
    backgroundColor: 'rgba(239,68,68,0.2)',
  },
  debugText: {
    color: colors.textSecondary,
    fontFamily: 'Rubik_400Regular',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
  },
});

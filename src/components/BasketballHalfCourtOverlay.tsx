import { useCallback, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

const COURT_WOOD = '#8B5A2B';
const LINE_COLOR = 'rgba(255, 255, 255, 0.95)';
const LINE_WIDTH = 2;

const PAINT_TOP = 0.07;
const PAINT_LEFT = 0.37;
const PAINT_WIDTH = 0.26;
const PAINT_HEIGHT = 0.32;

const LANE_MARKS = [0.22, 0.42, 0.62, 0.82];

interface BasketballHalfCourtOverlayProps {
  /** When false, lines float over the live camera feed. */
  opaque?: boolean;
}

/** Full free-throw circle centered on the FT line. */
function FreeThrowCircle({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const diameter = r * 2;
  return (
    <View
      style={{
        position: 'absolute',
        left: cx - r,
        top: cy - r,
        width: diameter,
        height: diameter,
        borderRadius: r,
        borderWidth: LINE_WIDTH,
        borderColor: LINE_COLOR,
        backgroundColor: 'transparent',
      }}
    />
  );
}

export function BasketballHalfCourtOverlay({ opaque = false }: BasketballHalfCourtOverlayProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  const { width, height } = size;
  const hasSize = width > 0 && height > 0;

  const paintLeft = width * PAINT_LEFT;
  const paintTop = height * PAINT_TOP;
  const paintWidth = width * PAINT_WIDTH;
  const paintHeight = height * PAINT_HEIGHT;
  const ftLineY = paintTop + paintHeight;
  const circleCx = paintLeft + paintWidth / 2;
  const circleCy = ftLineY;
  const circleR = paintWidth / 2;

  return (
    <View style={styles.root} onLayout={onLayout} pointerEvents="none">
      <View style={[styles.courtFill, opaque ? styles.courtFillOpaque : styles.courtFillClear]} />

      <View style={styles.sidelineLeft} />
      <View style={styles.sidelineRight} />
      <View style={styles.halfCourtLine} />

      <View style={styles.threePointArc} />
      <View style={styles.cornerLeft} />
      <View style={styles.cornerRight} />

      {hasSize && (
        <>
          <View
            style={[
              styles.line,
              { left: paintLeft, top: paintTop, width: LINE_WIDTH, height: paintHeight },
            ]}
          />
          <View
            style={[
              styles.line,
              {
                left: paintLeft + paintWidth - LINE_WIDTH,
                top: paintTop,
                width: LINE_WIDTH,
                height: paintHeight,
              },
            ]}
          />
          <View
            style={[
              styles.line,
              { left: paintLeft, top: ftLineY - 1, width: paintWidth, height: LINE_WIDTH },
            ]}
          />

          {LANE_MARKS.map((ratio) => (
            <View key={`lane-${ratio}`}>
              <View
                style={[
                  styles.line,
                  {
                    left: paintLeft - 5,
                    top: paintTop + paintHeight * ratio,
                    width: 5,
                    height: LINE_WIDTH,
                  },
                ]}
              />
              <View
                style={[
                  styles.line,
                  {
                    left: paintLeft + paintWidth,
                    top: paintTop + paintHeight * ratio,
                    width: 5,
                    height: LINE_WIDTH,
                  },
                ]}
              />
            </View>
          ))}

          <FreeThrowCircle cx={circleCx} cy={circleCy} r={circleR} />
        </>
      )}

      <View style={styles.backboard} />
      <View style={styles.rim} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    direction: 'ltr',
  },
  courtFill: {
    ...StyleSheet.absoluteFillObject,
  },
  courtFillOpaque: {
    backgroundColor: COURT_WOOD,
  },
  courtFillClear: {
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  line: {
    position: 'absolute',
    backgroundColor: LINE_COLOR,
  },
  sidelineLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: LINE_WIDTH,
    backgroundColor: LINE_COLOR,
  },
  sidelineRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: LINE_WIDTH,
    backgroundColor: LINE_COLOR,
  },
  halfCourtLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: LINE_WIDTH,
    backgroundColor: LINE_COLOR,
  },
  backboard: {
    position: 'absolute',
    top: '2.5%',
    left: '39%',
    width: '22%',
    height: LINE_WIDTH,
    backgroundColor: LINE_COLOR,
  },
  rim: {
    position: 'absolute',
    top: '5%',
    left: '46.5%',
    width: '7%',
    aspectRatio: 2.2,
    borderWidth: 2.5,
    borderColor: '#EF4444',
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  threePointArc: {
    position: 'absolute',
    top: '4%',
    left: '2%',
    right: '2%',
    height: '58%',
    borderWidth: LINE_WIDTH,
    borderColor: LINE_COLOR,
    borderTopWidth: 0,
    borderBottomLeftRadius: 9999,
    borderBottomRightRadius: 9999,
  },
  cornerLeft: {
    position: 'absolute',
    top: '4%',
    left: '2%',
    width: '11%',
    height: LINE_WIDTH,
    backgroundColor: LINE_COLOR,
  },
  cornerRight: {
    position: 'absolute',
    top: '4%',
    right: '2%',
    width: '11%',
    height: LINE_WIDTH,
    backgroundColor: LINE_COLOR,
  },
});

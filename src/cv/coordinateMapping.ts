import type { Orientation } from 'react-native-vision-camera';
import type { DetectionBox } from '@/src/types';

export interface CameraFrameLayout {
  frameWidth: number;
  frameHeight: number;
  displayWidth: number;
  displayHeight: number;
  orientation: Orientation;
  isMirrored?: boolean;
}

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface AxisAlignedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Portrait-locked app (e.g. 360×698) showing a landscape camera buffer (640×480). */
function shouldUseContainDirect(
  frameWidth: number,
  frameHeight: number,
  displayWidth: number,
  displayHeight: number
): boolean {
  if (frameWidth <= 0 || frameHeight <= 0 || displayWidth <= 0 || displayHeight <= 0) {
    return false;
  }
  return displayHeight > displayWidth;
}

function clipRectToDisplay(
  left: number,
  top: number,
  width: number,
  height: number,
  displayWidth: number,
  displayHeight: number
): ScreenRect {
  const right = left + width;
  const bottom = top + height;

  return {
    left: Math.max(0, left),
    top: Math.max(0, top),
    width: Math.max(0, Math.min(displayWidth, right) - Math.max(0, left)),
    height: Math.max(0, Math.min(displayHeight, bottom) - Math.max(0, top)),
  };
}

/**
 * contain-direct: map frame-buffer pixels into the view with letterbox scaling.
 * A 640×480 detection box maps 1:1 into the scaled preview region (no rotation).
 */
function mapWithContainDirect(
  box: AxisAlignedBox,
  frameWidth: number,
  frameHeight: number,
  displayWidth: number,
  displayHeight: number
): ScreenRect {
  const scale = Math.min(displayWidth / frameWidth, displayHeight / frameHeight);
  const scaledW = frameWidth * scale;
  const scaledH = frameHeight * scale;
  const offsetX = (displayWidth - scaledW) / 2;
  const offsetY = (displayHeight - scaledH) / 2;

  const left = box.x * scale + offsetX;
  const top = box.y * scale + offsetY;
  const width = box.width * scale;
  const height = box.height * scale;

  return clipRectToDisplay(left, top, width, height, displayWidth, displayHeight);
}

/** Vision Camera landscape-left buffer → portrait-upright preview (cover). */
function rotateLandscapeLeftToPortrait(
  box: AxisAlignedBox,
  frameWidth: number
): AxisAlignedBox {
  return {
    x: box.y,
    y: frameWidth - box.x - box.width,
    width: box.height,
    height: box.width,
  };
}

/** Fallback for landscape UI: cover scale + sensor rotation. */
function mapWithCoverRotation(
  box: AxisAlignedBox,
  frameWidth: number,
  frameHeight: number,
  displayWidth: number,
  displayHeight: number,
  orientation: Orientation,
  isMirrored: boolean
): ScreenRect {
  const contentWidth = frameHeight;
  const contentHeight = frameWidth;

  let mapped =
    orientation === 'landscape-right'
      ? {
          x: frameHeight - box.y - box.height,
          y: box.x,
          width: box.height,
          height: box.width,
        }
      : rotateLandscapeLeftToPortrait(box, frameWidth);

  if (isMirrored) {
    mapped = {
      ...mapped,
      x: contentWidth - mapped.x - mapped.width,
    };
  }

  const scale = Math.max(displayWidth / contentWidth, displayHeight / contentHeight);
  const offsetX = (displayWidth - contentWidth * scale) / 2;
  const offsetY = (displayHeight - contentHeight * scale) / 2;

  const left = mapped.x * scale + offsetX;
  const top = mapped.y * scale + offsetY;
  const width = mapped.width * scale;
  const height = mapped.height * scale;

  return clipRectToDisplay(left, top, width, height, displayWidth, displayHeight);
}

function mirrorInDisplay(box: ScreenRect, displayWidth: number): ScreenRect {
  return {
    ...box,
    left: displayWidth - box.left - box.width,
  };
}

/**
 * Map a detection box from camera-frame pixels to on-screen preview coordinates.
 * Primary path: contain-direct (portrait UI + landscape buffer).
 * Fallback: cover + rotation when the UI is landscape.
 */
export function mapDetectionBoxToScreen(
  box: DetectionBox,
  layout: CameraFrameLayout
): ScreenRect {
  const { frameWidth, frameHeight, displayWidth, displayHeight, orientation, isMirrored } = layout;

  if (frameWidth <= 0 || frameHeight <= 0 || displayWidth <= 0 || displayHeight <= 0) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }

  const axisBox: AxisAlignedBox = {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
  };

  let result: ScreenRect;

  if (shouldUseContainDirect(frameWidth, frameHeight, displayWidth, displayHeight)) {
    result = mapWithContainDirect(axisBox, frameWidth, frameHeight, displayWidth, displayHeight);
  } else {
    result = mapWithCoverRotation(
      axisBox,
      frameWidth,
      frameHeight,
      displayWidth,
      displayHeight,
      orientation,
      isMirrored ?? false
    );
  }

  if (isMirrored && shouldUseContainDirect(frameWidth, frameHeight, displayWidth, displayHeight)) {
    result = mirrorInDisplay(result, displayWidth);
  }

  return result;
}

import { forwardRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  type CameraProps,
  type Camera as CameraType,
} from 'react-native-vision-camera';
import type { ReadonlyFrameProcessor } from 'react-native-vision-camera';

interface InferenceCameraProps {
  isActive?: boolean;
  frameProcessor?: ReadonlyFrameProcessor;
}

/**
 * Vision Camera preview with native surface for overlay z-order on Android.
 */
export const InferenceCamera = forwardRef<CameraType, InferenceCameraProps>(
  function InferenceCamera({ isActive = true, frameProcessor }, ref) {
    const device = useCameraDevice('back');

    if (!device) {
      return <View style={styles.fallback} />;
    }

    const cameraProps: CameraProps = {
      ref,
      device,
      isActive,
      style: StyleSheet.absoluteFill,
      photo: true,
      video: false,
      audio: false,
      pixelFormat: 'yuv',
      outputOrientation: 'device',
      ...(Platform.OS === 'android' ? { androidPreviewViewType: 'surface-view' as const } : {}),
      ...(frameProcessor ? { frameProcessor } : {}),
    };

    return <Camera {...cameraProps} />;
  },
);

const styles = StyleSheet.create({
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0A0F',
  },
});

export type { CameraType as InferenceCameraRef };

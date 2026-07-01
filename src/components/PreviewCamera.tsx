import { StyleSheet } from 'react-native';
import { Camera, type CameraDevice } from 'react-native-vision-camera';

interface PreviewCameraProps {
  device: CameraDevice;
  isActive?: boolean;
}

/**
 * Preview-only camera: one hardware preview stream, no frame processor.
 * `photo`/`video`/`audio` are false to avoid extra Android output streams
 * that trigger invalid-output-configuration on many devices.
 */
export function PreviewCamera({ device, isActive = true }: PreviewCameraProps) {
  return (
    <Camera
      device={device}
      isActive={isActive}
      style={StyleSheet.absoluteFill}
      photo={false}
      video={false}
      audio={false}
      androidPreviewViewType="texture-view"
    />
  );
}

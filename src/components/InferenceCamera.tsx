import { StyleSheet } from 'react-native';
import {
  Camera,
  type CameraDevice,
  type Orientation,
  type ReadonlyFrameProcessor,
} from 'react-native-vision-camera';

interface InferenceCameraProps {
  device: CameraDevice;
  frameProcessor: ReadonlyFrameProcessor;
  isActive?: boolean;
  onPreviewOrientationChange?: (orientation: Orientation) => void;
}

/** Frame-processor camera — only mount when TFLite inference is active. */
export function InferenceCamera({
  device,
  frameProcessor,
  isActive = true,
  onPreviewOrientationChange,
}: InferenceCameraProps) {
  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={isActive}
      photo={false}
      video={false}
      audio={false}
      pixelFormat="yuv"
      frameProcessor={frameProcessor}
      androidPreviewViewType="surface-view"
      outputOrientation="device"
      onPreviewOrientationChanged={onPreviewOrientationChange}
    />
  );
}

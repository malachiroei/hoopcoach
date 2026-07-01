import { forwardRef } from 'react';
import { StyleSheet } from 'react-native';
import { Camera, type CameraDevice } from 'react-native-vision-camera';

interface PreviewCameraProps {
  device: CameraDevice;
  isActive?: boolean;
  enablePhotoCapture?: boolean;
}

/**
 * Preview camera used for cloud shot detection snapshots.
 * Photo capture is enabled only while cloud detection is active.
 */
export const PreviewCamera = forwardRef<Camera, PreviewCameraProps>(function PreviewCamera(
  { device, isActive = true, enablePhotoCapture = false },
  ref
) {
  return (
    <Camera
      ref={ref}
      device={device}
      isActive={isActive}
      style={StyleSheet.absoluteFill}
      photo={enablePhotoCapture}
      video={false}
      audio={false}
      androidPreviewViewType="texture-view"
    />
  );
});

import { forwardRef } from 'react';
import { StyleSheet } from 'react-native';
import { CameraView, type CameraViewProps } from 'expo-camera';

interface PreviewCameraProps {
  isActive?: boolean;
  enablePhotoCapture?: boolean;
  enableVideoCapture?: boolean;
}

/**
 * Expo Go compatible camera for cloud snapshots and on-demand highlight clips.
 */
export const PreviewCamera = forwardRef<CameraView, PreviewCameraProps>(function PreviewCamera(
  { isActive = true, enablePhotoCapture = false, enableVideoCapture = false },
  ref
) {
  const cameraProps: CameraViewProps = {
    facing: 'back',
    style: StyleSheet.absoluteFill,
    active: isActive,
    mute: true,
    mode: enableVideoCapture ? 'video' : enablePhotoCapture ? 'picture' : undefined,
  };

  return <CameraView ref={ref} {...cameraProps} />;
});

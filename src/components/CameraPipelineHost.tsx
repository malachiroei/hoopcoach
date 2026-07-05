import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useCameraPipeline } from '@/src/hooks/useCameraPipeline';
import type { FrameDetectionPayload } from '@/src/hooks/useTfliteFrameProcessor';
import type { CameraPipelineResult } from '@/src/hooks/useCameraPipeline';
import { colors } from '@/src/theme';

interface CameraPipelineHostProps {
  enabled: boolean;
  onDetections: (payload: FrameDetectionPayload) => void;
  onPipelineChange: (pipeline: CameraPipelineResult) => void;
}

/** Optional wrapper — reports pipeline state while model loads. */
export function CameraPipelineHost({
  enabled,
  onDetections,
  onPipelineChange,
}: CameraPipelineHostProps) {
  const pipeline = useCameraPipeline(onDetections, enabled);

  useEffect(() => {
    onPipelineChange(pipeline);
  }, [onPipelineChange, pipeline]);

  if (pipeline.modelState === 'loading') {
    return (
      <View style={styles.loading} pointerEvents="none">
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.text}>טוען מודל TFLite...</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,15,0.6)',
    zIndex: 5,
  },
  text: {
    color: colors.text,
    fontFamily: 'Rubik_400Regular',
    marginTop: 8,
  },
});

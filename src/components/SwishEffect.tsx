import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { colors } from '@/src/theme';

interface SwishEffectProps {
  visible: boolean;
  onComplete?: () => void;
}

export function SwishEffect({ visible, onComplete }: SwishEffectProps) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = 0;
      opacity.value = 1;
      scale.value = withSequence(
        withTiming(1.5, { duration: 300 }),
        withTiming(2, { duration: 200 })
      );
      opacity.value = withDelay(400, withTiming(0, { duration: 300 }));

      const timer = setTimeout(() => onComplete?.(), 700);
      return () => clearTimeout(timer);
    }
  }, [visible, onComplete, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={[styles.ring, animatedStyle]} />
      <Animated.View style={[styles.ring, styles.ringInner, animatedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: colors.primary,
    position: 'absolute',
  },
  ringInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderColor: colors.accent,
    borderWidth: 3,
  },
});

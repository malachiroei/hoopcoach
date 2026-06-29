import { useRef, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  View,
  FlatList,
  type ViewToken,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { Button } from '@/src/components/Button';
import { updateUserProfile } from '@/src/services/database';
import { colors, spacing, typography } from '@/src/theme';

const { width } = Dimensions.get('window');

const STEPS = [
  { titleKey: 'onboarding.step1Title', descKey: 'onboarding.step1Desc', emoji: '📱' },
  { titleKey: 'onboarding.step2Title', descKey: 'onboarding.step2Desc', emoji: '🏀' },
  { titleKey: 'onboarding.step3Title', descKey: 'onboarding.step3Desc', emoji: '🔥' },
];

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const handleNext = async () => {
    if (currentIndex < STEPS.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      await updateUserProfile({ onboardingComplete: true });
      router.replace('/(tabs)');
    }
  };

  const handleSkip = async () => {
    await updateUserProfile({ onboardingComplete: true });
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={STEPS}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInRight.delay(index * 100)} style={styles.slide}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.title}>{t(item.titleKey)}</Text>
            <Text style={styles.desc}>{t(item.descKey)}</Text>
          </Animated.View>
        )}
      />

      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.actions}>
        <Button
          title={currentIndex === STEPS.length - 1 ? t('onboarding.start') : t('onboarding.next')}
          onPress={handleNext}
          fullWidth
          size="lg"
        />
        {currentIndex < STEPS.length - 1 && (
          <Button title={t('onboarding.skip')} onPress={handleSkip} variant="ghost" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 80,
    paddingBottom: spacing.xl,
  },
  slide: {
    width,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 80,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.hero,
    color: colors.text,
    textAlign: 'center',
    fontFamily: 'Rubik_800ExtraBold',
    marginBottom: spacing.md,
  },
  desc: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    fontFamily: 'Rubik_400Regular',
  },
  dots: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  actions: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
});

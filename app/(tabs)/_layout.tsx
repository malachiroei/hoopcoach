import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/src/theme';

const TAB_BAR_BASE_HEIGHT = 56;

export default function TabLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: TAB_BAR_BASE_HEIGHT + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: 'Rubik_600SemiBold',
          fontSize: 11,
        },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: 'Rubik_700Bold' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('home.startSession'),
          headerTitle: 'HoopCoach',
          tabBarIcon: ({ color }) => (
            <Ionicons name="basketball" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('history.title'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="time" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile.title'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="person" size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

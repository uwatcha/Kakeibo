import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useTheme } from 'react-native-paper';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

function tabIcon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <MaterialCommunityIcons name={name} color={typeof color === 'string' ? color : undefined} size={size} />;
  };
}

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarStyle: { backgroundColor: theme.colors.elevation.level2 },
        headerStyle: { backgroundColor: theme.colors.elevation.level2 },
        headerTintColor: theme.colors.onSurface,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'ホーム', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="transactions" options={{ title: '記録', tabBarIcon: tabIcon('format-list-bulleted') }} />
      <Tabs.Screen name="reports" options={{ title: '集計', tabBarIcon: tabIcon('chart-pie') }} />
      <Tabs.Screen name="settings" options={{ title: '設定', tabBarIcon: tabIcon('cog') }} />
    </Tabs>
  );
}

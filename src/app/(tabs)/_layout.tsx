import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { type ColorValue, StyleSheet, View } from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';

import { AvailableAccountsButton } from '@/features/accounts/components/AvailableAccountsButton';

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
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopWidth: 0, elevation: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        // 大きな太字の見出しを左に置き、ヘッダーと画面の背景をつなげる
        headerStyle: { backgroundColor: theme.colors.background },
        headerShadowVisible: false,
        headerTintColor: theme.colors.onSurface,
        headerTitleAlign: 'left',
        headerTitleStyle: { fontSize: 26, fontWeight: '800' },
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: tabIcon('home'),
          // 用語の説明はヘッダーの小さなアイコンから開く
          headerRight: () => (
            <View style={styles.headerRight}>
              <IconButton
                icon="information-outline"
                iconColor={theme.colors.primary}
                accessibilityLabel="用語の説明"
                onPress={() => router.push('/info')}
              />
              {/* 記録・集計と同じく、汎用資産のボタンはいちばん右 */}
              <AvailableAccountsButton />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: '記録',
          tabBarIcon: tabIcon('format-list-bulleted'),
          headerRight: () => <AvailableAccountsButton />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: '集計',
          tabBarIcon: tabIcon('chart-pie'),
          headerRight: () => <AvailableAccountsButton />,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: 'AI 相談',
          tabBarLabel: 'AI',
          tabBarIcon: tabIcon('robot-outline'),
          tabBarHideOnKeyboard: true,
        }}
      />
      <Tabs.Screen name="settings" options={{ title: '設定', tabBarIcon: tabIcon('cog') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row' },
});

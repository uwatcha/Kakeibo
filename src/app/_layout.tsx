import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { PaperProvider, useTheme } from 'react-native-paper';

import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { RecurringRunner } from '@/features/recurring/RecurringRunner';
import { UpdateButton } from '@/features/updates/UpdateButton';
import { themes } from '@/theme';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootNavigator() {
  const { session, isLoading } = useAuth();
  const theme = useTheme();

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // ヘッダーは画面の背景と同じ色にして境目の線を消す
        headerStyle: { backgroundColor: theme.colors.background },
        headerShadowVisible: false,
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="accounts/index" options={{ headerShown: true, title: '口座の管理' }} />
        <Stack.Screen name="accounts/[id]" options={{ headerShown: true, title: '口座' }} />
        <Stack.Screen name="transaction/[id]" options={{ headerShown: true, title: '記録' }} />
        <Stack.Screen name="categories/index" options={{ headerShown: true, title: 'カテゴリの管理' }} />
        <Stack.Screen name="categories/[id]" options={{ headerShown: true, title: 'カテゴリ' }} />
        <Stack.Screen name="employers/index" options={{ headerShown: true, title: '働き先と給料日' }} />
        <Stack.Screen name="employers/[id]" options={{ headerShown: true, title: '働き先' }} />
        <Stack.Screen name="account-history/[id]" options={{ headerShown: true, title: '口座' }} />
        <Stack.Screen name="card-settings/[id]" options={{ headerShown: true, title: 'カードの設定' }} />
        <Stack.Screen name="recurring/index" options={{ headerShown: true, title: '定期支払い' }} />
        <Stack.Screen name="recurring/[id]" options={{ headerShown: true, title: '定期支払い' }} />
        <Stack.Screen
          name="balance-chart"
          options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }}
        />
        <Stack.Screen name="ai-history" options={{ headerShown: true, title: '会話の履歴' }} />
        <Stack.Screen name="ai-settings" options={{ headerShown: true, title: 'AI 相談の設定' }} />
        <Stack.Screen name="transfer-order" options={{ headerShown: true, title: '振替の優先度' }} />
        <Stack.Screen name="unconfirmed" options={{ headerShown: true, title: '未確認の記録' }} />
        <Stack.Screen name="info" options={{ headerShown: true, title: '用語の説明' }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? themes.dark : themes.light;

  return (
    // ドラッグ＆ドロップ（react-native-reorderable-list）などのジェスチャーに必要
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <PaperProvider theme={theme}>
            <AuthProvider>
              <StatusBar style="auto" />
              <RecurringRunner />
              <RootNavigator />
              <UpdateButton />
            </AuthProvider>
          </PaperProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

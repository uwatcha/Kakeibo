import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { PaperProvider } from 'react-native-paper';

import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { themes } from '@/theme';

import { closeQuick, QuickEntrySheet } from './QuickEntrySheet';
import { QuickPhoto } from './QuickPhoto';

const queryClient = new QueryClient();

type Mode = 'add' | 'photo';
const modeOf = (url: string | null): Mode => (url && /^kakeibo-quick:\/\/photo/.test(url) ? 'photo' : 'add');

/**
 * 開いた URL（kakeibo-quick://add・kakeibo-quick://photo）。ウィジェットを押すたびに nonce が変わる
 * （この画面はホーム画面に戻っても残っていることがあるので、押されたらやり直す）
 */
function useQuickUrl() {
  const [state, setState] = useState<{ mode: Mode; nonce: number } | null>(null);
  useEffect(() => {
    Linking.getInitialURL().then((url) => setState({ mode: modeOf(url), nonce: Date.now() }));
    const subscription = Linking.addEventListener('url', ({ url }) =>
      setState({ mode: modeOf(url), nonce: Date.now() }),
    );
    return () => subscription.remove();
  }, []);
  return state;
}

function QuickContent() {
  const { session, isLoading } = useAuth();
  const quick = useQuickUrl();

  // ログインしていなければアプリを開く
  useEffect(() => {
    if (isLoading || session) return;
    Linking.openURL('kakeibo://');
    closeQuick();
  }, [isLoading, session]);

  if (isLoading || !session || !quick) return null;
  return (
    <View style={styles.container}>
      {/* シートの外を押したら閉じる */}
      <Pressable style={styles.backdrop} onPress={closeQuick} accessibilityLabel="閉じる" />
      {quick.mode === 'photo' ? <QuickPhoto nonce={quick.nonce} /> : <QuickEntrySheet key={quick.nonce} />}
    </View>
  );
}

/**
 * ホーム画面のウィジェットから開く、背景が透けた入力用の画面の中身（AppRegistry の 'quickadd'。index.ts で登録し、
 * plugins/withQuickAddActivity.js が作る QuickAddActivity が出す）。アプリ本体とは別に、必要なものだけを用意する
 */
export function QuickAddRoot() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={styles.root}>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <PaperProvider theme={colorScheme === 'dark' ? themes.dark : themes.light}>
            <AuthProvider>
              <QuickContent />
            </AuthProvider>
          </PaperProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
});

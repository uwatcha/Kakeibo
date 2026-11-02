import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Snackbar, Switch, useTheme } from 'react-native-paper';

import { ListRow } from '@/components/ListRow';
import { SectionCard } from '@/components/SectionCard';
import { useAiStatus } from '@/features/ai/hooks';
import { startBackgroundTask } from '@/features/background/backgroundTask';
import { disablePhotoImport, enablePhotoImport, scanNewPhotos } from '@/features/photoImport/scan';
import { loadPhotoImportState, type PhotoImportState } from '@/features/photoImport/settings';
import { SPACING } from '@/theme';

const formatTime = (ms: number) =>
  new Date(ms).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * 設定 > 写真からの記録。オンにすると、この端末の新しい写真（カメラ・スクリーンショット）を AI が見て、
 * レシート・決済完了の画面・自販機の値段の表示なら記録する（features/photoImport）。設定はこの端末だけ
 */
export default function PhotoImportScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const ai = useAiStatus();
  const [state, setState] = useState<PhotoImportState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadPhotoImportState().then(setState);
  }, []);

  const toggle = async (next: boolean) => {
    setBusy(true);
    try {
      if (next) {
        if (!(await enablePhotoImport())) {
          setMessage('写真を読む許可がありません');
          return;
        }
        // 閉じている間も確かめるよう、バックグラウンドの確認を始める
        startBackgroundTask();
      } else {
        await disablePhotoImport();
      }
      setState(await loadPhotoImportState());
    } finally {
      setBusy(false);
    }
  };

  const checkNow = async () => {
    setBusy(true);
    try {
      const result = await scanNewPhotos();
      setState(await loadPhotoImportState());
      queryClient.invalidateQueries();
      if (!result) return;
      setMessage(
        result.waiting
          ? 'AI が混み合っているので、続きはあとで確かめます'
          : `${result.checked}枚を見て、${result.recorded}件を記録しました${result.merged > 0 ? `（メールの記録にまとめた ${result.merged}件）` : ''}${result.duplicates > 0 ? `（重複の可能性 ${result.duplicates}件）` : ''}`,
      );
    } catch {
      setMessage('確かめられませんでした');
    } finally {
      setBusy(false);
    }
  };

  const chevron = <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: '写真からの記録' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionCard>
          <ListRow
            title="写真からの記録"
            icon="image-search-outline"
            subtitle={state?.lastRunAt ? `最後に確かめた時刻: ${formatTime(state.lastRunAt)}` : undefined}
            right={<Switch value={!!state?.enabled} disabled={!state || busy} onValueChange={toggle} />}
            onPress={() => state && !busy && toggle(!state.enabled)}
          />
          {ai.data && !ai.data.hasKey && (
            <ListRow
              title="AI と連携する"
              icon="link"
              iconColor={theme.colors.error}
              right={chevron}
              onPress={() => router.push('/ai-settings')}
            />
          )}
        </SectionCard>
        {state?.enabled && (
          <Button mode="outlined" icon="refresh" onPress={checkNow} loading={busy} disabled={busy}>
            今すぐ確かめる
          </Button>
        )}
      </ScrollView>
      <Snackbar visible={message !== null} onDismiss={() => setMessage(null)}>
        {message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.screen, paddingTop: 4, gap: SPACING.gap, paddingBottom: 48 },
});

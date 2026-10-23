import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';

import { AiError } from '@/features/ai/api';
import { queuePhoto } from '@/features/photoImport/queue';
import { loadPhotoContext, recordPhoto, toJpegBase64 } from '@/features/photoImport/scan';
import { formatYen } from '@/lib/money';
import { RADIUS, SPACING } from '@/theme';

import { closeQuick } from './QuickEntrySheet';

/** 結果を出してから閉じるまで */
const CLOSE_AFTER_MS = 2500;

type Phase = { kind: 'camera' } | { kind: 'reading' } | { kind: 'done'; message: string };

/**
 * ウィジェットの「写真」: カメラをすぐ開き、撮った写真を AI が読み取って、確認なしで支払いとして記録する
 * （写真からの記録と同じ読み取り。あとから「記録の確認」の「自動で追加」で見る）。結果を短く出して閉じる。
 * AI が混み合っていれば端末に置いておき、バックグラウンドで記録する。撮った写真はギャラリーに残らない
 */
export function QuickPhoto({ nonce }: { nonce: number }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>({ kind: 'camera' });
  const started = useRef<number | null>(null);

  useEffect(() => {
    if (started.current === nonce) return;
    started.current = nonce;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (message: string) => {
      setPhase({ kind: 'done', message });
      timer = setTimeout(closeQuick, CLOSE_AFTER_MS);
    };
    (async () => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return finish('カメラを使う許可がありません');
      const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
      const asset = shot.assets?.[0];
      if (shot.canceled || !asset) return closeQuick();
      setPhase({ kind: 'reading' });
      const takenAt = Date.now();
      const key = `widget:${takenAt}`;
      let data: string | null = null;
      try {
        data = await toJpegBase64(asset.uri, asset.width);
        const result = await recordPhoto(await loadPhotoContext(), data, key, takenAt);
        queryClient.invalidateQueries();
        if (!result.first) return finish('記録できる内容がありませんでした');
        const what = [result.first.payee, formatYen(result.first.amount)].filter(Boolean).join(' ');
        finish(result.first.status === 'recorded' ? `記録しました: ${what}` : `重複の可能性: ${what}`);
      } catch (e) {
        if (e instanceof AiError && e.temporary && data) {
          await queuePhoto({ key, data, takenAt });
          return finish('混み合っているので、あとで記録します');
        }
        finish(e instanceof AiError ? e.message : '読み取れませんでした');
      }
    })();
    return () => clearTimeout(timer);
  }, [nonce, queryClient]);

  if (phase.kind === 'camera') return null;
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.background }]}>
      {phase.kind === 'reading' ? (
        <View style={styles.row}>
          <ActivityIndicator />
          <Text variant="bodyLarge">読み取っています…</Text>
        </View>
      ) : (
        <View style={styles.row}>
          <Text variant="bodyLarge" style={styles.message}>
            {phase.message}
          </Text>
          <Button onPress={closeQuick}>閉じる</Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
    padding: SPACING.screen,
    paddingBottom: 32,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  message: { flex: 1 },
});

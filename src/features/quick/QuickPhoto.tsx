import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';

import { processQuickPhotos } from '@/features/background/backgroundTask';
import { queuePhoto } from '@/features/photoImport/queue';
import { toJpegBase64 } from '@/features/ai/image';
import { RADIUS, SPACING } from '@/theme';

import { closeQuick } from './QuickEntrySheet';

/** 結果を出してから閉じるまで（許可がない・置けなかったときだけ） */
const CLOSE_AFTER_MS = 2500;

type Phase = { kind: 'camera' } | { kind: 'reading' } | { kind: 'done'; message: string };

/**
 * ウィジェットの「写真」: カメラをすぐ開き、撮った写真を端末の読み取り待ちに置いて、すぐ閉じる
 * （2026-10-25 ユーザーの要望: 読み取りを待たずに閉じる）。読み取りは裏で続け、AI が確認なしで支払いとして記録して、
 * 結果を通知する（写真からの記録と同じ読み取り。あとから「記録の確認」の「自動で追加」で見る）。
 * 途中でアプリが止められても、読み取り待ちに残り、バックグラウンドの確認で続きから読む。撮った写真はギャラリーに残らない
 */
export function QuickPhoto({ nonce }: { nonce: number }) {
  const theme = useTheme();
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
      // 小さくして置くまでの1〜2秒だけ出す
      setPhase({ kind: 'reading' });
      const takenAt = Date.now();
      try {
        await queuePhoto({ key: `widget:${takenAt}`, data: await toJpegBase64(asset.uri, asset.width), takenAt });
      } catch {
        return finish('写真を保存できませんでした');
      }
      closeQuick();
      // 画面を閉じても、アプリが止められるまでは読み取りを続ける（結果は通知）
      processQuickPhotos();
    })();
    return () => clearTimeout(timer);
  }, [nonce]);

  if (phase.kind === 'camera') return null;
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.background }]}>
      {phase.kind === 'reading' ? (
        <View style={styles.row}>
          <ActivityIndicator />
          <Text variant="bodyLarge">保存しています…</Text>
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

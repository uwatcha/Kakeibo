import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';

import { notifyQuickPhotoFailure, processQuickPhotos } from '@/features/background/backgroundTask';
import { queuePhoto } from '@/features/photoImport/queue';
import { toJpegBase64 } from '@/features/ai/image';
import { RADIUS, SPACING } from '@/theme';

import { closeQuick } from './QuickEntrySheet';

/** 結果を出してから閉じるまで（許可がない・置けなかったときだけ） */
const CLOSE_AFTER_MS = 2500;

/** 画面が前面に出たのを待つ上限 */
const ACTIVE_TIMEOUT_MS = 3000;
/** カメラを開けなかったときに、やり直すまでの間 */
const RETRY_MS = [500, 1500];
/** 前に開いたカメラが片付く（閉じた結果が戻る）のを待つ上限 */
const PREVIOUS_TIMEOUT_MS = 1500;

/** 画面が前面に出る（AppState が active になる）まで待つ。出なくても ACTIVE_TIMEOUT_MS で進む */
function waitUntilActive(): Promise<void> {
  if (AppState.currentState === 'active') return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, ACTIVE_TIMEOUT_MS);
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && done());
    function done() {
      clearTimeout(timer);
      subscription.remove();
      resolve();
    }
  });
}

/**
 * カメラを開く。2回目以降は、カメラの結果を受け取る仕組み（expo-modules-core の ActivityResult の登録）が、
 * 前に閉じた画面と一緒に外れていて、この画面が前面に出たとき（onHostResume）に付け直される。
 * その前に開くと「登録されていない」で失敗し、透けた背景だけが残っていた（2026-11-24）ので、前面に出るのを待ち、
 * 失敗したら少し待ってやり直す
 */
async function launchCamera(): Promise<ImagePicker.ImagePickerResult> {
  await waitUntilActive();
  for (const wait of [...RETRY_MS, null]) {
    try {
      return await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    } catch (e) {
      if (wait === null) throw e;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw new Error('unreachable');
}

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
  // 前に開いたカメラ（閉じた結果が戻るまで）
  const previousLaunch = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    if (started.current === nonce) return;
    started.current = nonce;
    /**
     * もっと新しくウィジェットが押された。カメラを開いたままホーム画面に戻ってもう一度押すと、この画面は singleTask
     * なので上のカメラが閉じられ、前の回は「撮らずに閉じた」として戻ってくる。そこで画面を閉じると、新しい回の
     * カメラまで消えていた（2026-11-24）。古い回の結果は何もしない
     */
    const stale = () => started.current !== nonce;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // 画面は少しで閉じるので、失敗は通知にも残す（2026-11-24 ユーザーの要望）
    const finish = (message: string) => {
      if (stale()) return;
      setPhase({ kind: 'done', message });
      notifyQuickPhotoFailure(message);
      timer = setTimeout(closeQuick, CLOSE_AFTER_MS);
    };
    (async () => {
      // 許可の確認も画面に結び付いているので、前面に出てから
      await waitUntilActive();
      const permission = await ImagePicker.requestCameraPermissionsAsync().catch(() => null);
      if (!permission?.granted) return finish('カメラを使う許可がありません');
      setPhase({ kind: 'camera' });
      let shot: ImagePicker.ImagePickerResult;
      try {
        // 前の回のカメラが閉じた結果を受け取り終えてから開く（同時に開くと結果の受け取りが混ざる）
        await Promise.race([previousLaunch.current, new Promise((r) => setTimeout(r, PREVIOUS_TIMEOUT_MS))]);
        if (stale()) return;
        const launch = launchCamera();
        previousLaunch.current = launch.catch(() => undefined);
        shot = await launch;
      } catch (e) {
        return finish(
          `カメラを開けませんでした。もう一度ウィジェットを押してください（${e instanceof Error ? e.message : String(e)}）`,
        );
      }
      if (stale()) return;
      const asset = shot.assets?.[0];
      if (shot.canceled || !asset) return closeQuick();
      // 小さくして置くまでの1〜2秒だけ出す
      setPhase({ kind: 'reading' });
      const takenAt = Date.now();
      try {
        await queuePhoto({ key: `widget:${takenAt}`, data: await toJpegBase64(asset.uri, asset.width), takenAt });
      } catch (e) {
        return finish(
          `写真を保存できませんでした。もう一度撮ってください（${e instanceof Error ? e.message : String(e)}）`,
        );
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

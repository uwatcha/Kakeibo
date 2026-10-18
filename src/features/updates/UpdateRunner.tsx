import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';

/**
 * 配信した更新（EAS Update）を取り込む（画面には何も出さない）
 * - 起動したとき: 新しい更新があればその場で読み込み直す（開き直さなくても反映される）
 * - 前面に戻ったとき: 入力中の内容を消さないよう、受け取るだけにして次の起動で反映する
 */
export function UpdateRunner() {
  useEffect(() => {
    // Expo Go・開発中は更新の仕組みが無い
    if (__DEV__ || !Updates.isEnabled) return;
    let running = false;
    const run = async (reload: boolean) => {
      if (running) return;
      running = true;
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable) return;
        const fetched = await Updates.fetchUpdateAsync();
        if (fetched.isNew && reload) await Updates.reloadAsync();
      } catch {
        // 通信できないときは次に開いたときにまた試す
      } finally {
        running = false;
      }
    };
    run(true);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') run(false);
    });
    return () => subscription.remove();
  }, []);

  return null;
}

import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { FAB, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CHECK_INTERVAL_MS = 60_000;

/**
 * 開発用: 新しい更新（EAS Update）が配信されていれば左下に小さなボタンを出し、押すとその場で読み込み直す。
 * 開いたとき・前面に戻ったとき・開いている間は1分ごとに確かめる。Expo Go・開発中は出さない
 */
export function UpdateButton() {
  if (__DEV__ || !Updates.isEnabled) return null;
  return <UpdateButtonInner />;
}

function UpdateButtonInner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isUpdateAvailable, isUpdatePending } = Updates.useUpdates();
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const check = () => {
      if (AppState.currentState !== 'active') return;
      Updates.checkForUpdateAsync().catch(() => {
        // 通信できないときは次の確認でまた試す
      });
    };
    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  if (!isUpdateAvailable && !isUpdatePending) return null;

  const apply = async () => {
    setApplying(true);
    try {
      if (!isUpdatePending) await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setApplying(false);
    }
  };

  return (
    <FAB
      icon="cloud-download"
      size="small"
      loading={applying}
      disabled={applying}
      accessibilityLabel="更新を反映"
      color={theme.colors.onPrimary}
      style={[styles.button, { backgroundColor: theme.colors.primary, bottom: insets.bottom + 72 }]}
      onPress={apply}
    />
  );
}

const styles = StyleSheet.create({
  button: { position: 'absolute', left: 16 },
});

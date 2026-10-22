import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';

type Props = {
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
};

/** 読み込み中・エラー時の共通表示。どちらでもなければ何も出さない */
export function QueryState({ isLoading, error, onRetry }: Props) {
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text variant="bodyMedium">読み込めませんでした</Text>
        <Button onPress={onRetry}>再読み込み</Button>
      </View>
    );
  }
  return null;
}

type QueryLike = { error: Error | null; refetch: () => unknown };

/**
 * いくつかの読み込みを待つ画面の、読み込み中・エラー時の表示。どれかが失敗したらエラー、そうでなければ読み込み中。
 * 「再読み込み」で渡したものを全部読み直す（使っていない読み込み（enabled が false）は渡さない）
 */
export function QueriesState({ queries }: { queries: readonly QueryLike[] }) {
  const error = queries.find((q) => q.error)?.error ?? null;
  return <QueryState isLoading={!error} error={error} onRetry={() => queries.forEach((q) => q.refetch())} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
});

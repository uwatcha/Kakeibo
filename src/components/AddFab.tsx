import { StyleSheet } from 'react-native';
import { FAB, useTheme } from 'react-native-paper';

type Props = {
  onPress: () => void;
  /** 読み上げ用。label を出すときはそれが読まれる */
  accessibilityLabel?: string;
  label?: string;
};

/** 右下の追加ボタン。濃い色の角丸で、どの画面でも同じ見た目にする */
export function AddFab({ onPress, accessibilityLabel, label }: Props) {
  const theme = useTheme();
  return (
    <FAB
      icon="plus"
      label={label}
      accessibilityLabel={accessibilityLabel ?? label}
      color={theme.colors.onPrimary}
      style={[styles.fab, { backgroundColor: theme.colors.primary }]}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 16, bottom: 16 },
});

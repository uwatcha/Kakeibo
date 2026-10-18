import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

export default function TransactionsScreen() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="bodyLarge">記録一覧（準備中）</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useReorderableDrag } from 'react-native-reorderable-list';

/** ReorderableList の行に置くつまみ。押した瞬間にドラッグを始める */
export function DragHandle({ label }: { label: string }) {
  const theme = useTheme();
  const drag = useReorderableDrag();
  return (
    <Pressable onPressIn={drag} hitSlop={12} accessibilityLabel={`${label}を並べ替え`} style={styles.handle}>
      <MaterialCommunityIcons name="drag-horizontal-variant" size={24} color={theme.colors.onSurfaceVariant} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  handle: { justifyContent: 'center', paddingHorizontal: 8 },
});

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip } from 'react-native-paper';

export type ChipOption = { value: string; label: string; icon?: string };

type Props = {
  options: readonly ChipOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** true なら選択中のチップをもう一度押すと選択を外す */
  allowDeselect?: boolean;
  /** 列の最後に足すチップ（「すべて表示」など） */
  extra?: ReactNode;
  /** 2 なら2行に分けて並べ、横スクロールは2行まとめて動く（少ないときは1行） */
  rows?: 1 | 2;
};

/** 2行にするのは、チップがこの数より多いとき */
const MIN_FOR_TWO_ROWS = 4;

/** 横スクロールで1つ選ぶチップの列。口座・カテゴリ・種類の選択に使う */
export function ChipGroup({ options, value, onChange, allowDeselect = false, extra, rows = 1 }: Props) {
  const chip = (o: ChipOption) => {
    const selected = o.value === value;
    return (
      <Chip
        key={o.value}
        icon={o.icon}
        selected={selected}
        showSelectedOverlay
        onPress={() => onChange(selected && allowDeselect ? null : o.value)}
      >
        {o.label}
      </Chip>
    );
  };

  if (rows === 1 || options.length <= MIN_FOR_TWO_ROWS) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {options.map(chip)}
        {extra}
      </ScrollView>
    );
  }

  // 前半を上の行、後半を下の行に置き、1つの横スクロールに入れて一緒に動かす
  const half = Math.ceil(options.length / 2);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.grid}>
      <View style={styles.row}>{options.slice(0, half).map(chip)}</View>
      <View style={styles.row}>
        {options.slice(half).map(chip)}
        {extra}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  grid: { flexDirection: 'column' },
});

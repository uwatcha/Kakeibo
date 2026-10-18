import { ScrollView, StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';

export type ChipOption = { value: string; label: string; icon?: string };

type Props = {
  options: readonly ChipOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** true なら選択中のチップをもう一度押すと選択を外す */
  allowDeselect?: boolean;
};

/** 横スクロールで1つ選ぶチップの列。口座・カテゴリ・種類の選択に使う */
export function ChipGroup({ options, value, onChange, allowDeselect = false }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((o) => {
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
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4 },
});

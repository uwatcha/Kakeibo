import { StyleSheet, View } from 'react-native';
import { HelperText, Text } from 'react-native-paper';

import { ChipGroup } from '@/components/ChipGroup';
import type { Category } from '@/features/categories/api';

import type { CategoryKind } from '../transactionRules';

type Props = {
  kind: CategoryKind;
  categories: readonly Category[];
  value: string | null;
  onChange: (id: string | null) => void;
  error?: string;
  label?: string;
};

/** 大分類を選ぶと、小分類があればその下に出す。大分類だけでも記録できる */
export function CategoryPicker({ kind, categories, value, onChange, error, label = 'カテゴリ' }: Props) {
  const usable = categories.filter((c) => c.kind === kind && (!c.is_archived || c.id === value));
  const parents = usable.filter((c) => c.parent_id === null);
  const selected = usable.find((c) => c.id === value);
  const selectedParentId = selected?.parent_id ?? selected?.id ?? null;
  const children = usable.filter((c) => c.parent_id !== null && c.parent_id === selectedParentId);

  return (
    <View style={styles.container}>
      <Text variant="labelLarge">{label}</Text>
      <ChipGroup
        options={parents.map((c) => ({ value: c.id, label: c.name }))}
        value={selectedParentId}
        onChange={onChange}
        allowDeselect
      />
      {children.length > 0 && (
        <ChipGroup
          options={children.map((c) => ({ value: c.id, label: c.name }))}
          value={selected?.parent_id ? selected.id : null}
          onChange={(id) => onChange(id ?? selectedParentId)}
          allowDeselect
        />
      )}
      {!!error && <HelperText type="error">{error}</HelperText>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
});

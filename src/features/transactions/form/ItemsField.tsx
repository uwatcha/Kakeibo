import { useState } from 'react';
import { type Control, Controller, useWatch } from 'react-hook-form';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, HelperText, IconButton, Portal, Text, TextInput, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import type { Category } from '@/features/categories/api';
import { categoryLabel } from '@/features/categories/tree';
import { formatYen, parseYen } from '@/lib/money';

import { ADJUSTMENT_LABEL, adjustmentOf, type ItemDraft } from '../items';
import type { FormValues } from './values';

let nextKey = 0;
const newItem = (): ItemDraft => ({ key: `new-${Date.now()}-${nextKey++}`, name: '', categoryId: null, amount: '' });

/**
 * 支払いの内訳（2026-11-02 改善要望）。品目の行（品名・金額・カテゴリ）を足していき、最後の「割引・調整」の行は
 * 合計（金額の欄）− 品目の合計 で自動で出す（割引・消費税の端数のずれを吸収する）。内訳があれば記録のカテゴリは
 * いちばん金額の大きい品目のものになる（values.ts の toTransactionRow）
 */
export function ItemsField({
  control,
  categories,
  error,
}: {
  control: Control<FormValues>;
  categories: readonly Category[];
  error?: string;
}) {
  const theme = useTheme();
  const amount = useWatch({ control, name: 'amount' });
  // カテゴリを選んでいる行
  const [picking, setPicking] = useState<string | null>(null);
  const expense = categories
    .filter((c) => c.kind === 'expense' && !c.is_archived)
    .map((c) => ({ id: c.id, label: categoryLabel(c.id, categories) ?? c.name }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ja'));

  return (
    <Controller
      control={control}
      name="items"
      render={({ field: { onChange, value: items } }) => {
        const update = (key: string, patch: Partial<ItemDraft>) =>
          onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
        const total = parseYen(amount);
        const adjustment = total === null ? null : adjustmentOf(total, items);
        return (
          <View style={styles.field}>
            <View style={styles.header}>
              <Text variant="labelLarge">内訳</Text>
              <Button compact icon="plus" onPress={() => onChange([...items, newItem()])}>
                行を足す
              </Button>
            </View>
            {items.map((item) => (
              <View key={item.key} style={styles.row}>
                <TextInput
                  mode="outlined"
                  dense
                  label="品名"
                  value={item.name}
                  onChangeText={(name) => update(item.key, { name })}
                  style={styles.name}
                />
                <TextInput
                  mode="outlined"
                  dense
                  label="金額"
                  keyboardType="numbers-and-punctuation"
                  value={item.amount}
                  onChangeText={(text) => update(item.key, { amount: text })}
                  style={styles.amount}
                />
                <Chip compact onPress={() => setPicking(item.key)} style={styles.category}>
                  {item.categoryId ? (categoryLabel(item.categoryId, categories) ?? 'カテゴリ') : 'カテゴリ'}
                </Chip>
                <IconButton
                  icon="close"
                  size={18}
                  accessibilityLabel="この行を消す"
                  onPress={() => onChange(items.filter((i) => i.key !== item.key))}
                />
              </View>
            ))}
            {items.length > 0 && adjustment !== null && (
              <View style={styles.adjustment}>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {ADJUSTMENT_LABEL}
                </Text>
                <Amount value={adjustment} kind="delta" variant="bodyMedium" />
              </View>
            )}
            {items.length > 0 && total !== null && (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                合計 {formatYen(total)}
              </Text>
            )}
            {error && <HelperText type="error">{error}</HelperText>}

            <Portal>
              <Dialog visible={picking !== null} onDismiss={() => setPicking(null)} style={styles.dialog}>
                <Dialog.Title>カテゴリ</Dialog.Title>
                <Dialog.ScrollArea style={styles.area}>
                  <ScrollView contentContainerStyle={styles.choices}>
                    {expense.map((c) => (
                      <Chip
                        key={c.id}
                        selected={items.find((i) => i.key === picking)?.categoryId === c.id}
                        showSelectedOverlay
                        onPress={() => {
                          if (picking) update(picking, { categoryId: c.id });
                          setPicking(null);
                        }}
                      >
                        {c.label}
                      </Chip>
                    ))}
                  </ScrollView>
                </Dialog.ScrollArea>
                <Dialog.Actions>
                  <Button
                    onPress={() => {
                      if (picking) update(picking, { categoryId: null });
                      setPicking(null);
                    }}
                  >
                    未分類にする
                  </Button>
                  <Button onPress={() => setPicking(null)}>閉じる</Button>
                </Dialog.Actions>
              </Dialog>
            </Portal>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flex: 1.4 },
  amount: { flex: 1 },
  category: { maxWidth: 120 },
  adjustment: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 4 },
  dialog: { maxHeight: '80%' },
  area: { paddingHorizontal: 0 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 16 },
});

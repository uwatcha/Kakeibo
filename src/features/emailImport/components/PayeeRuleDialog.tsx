import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Dialog, TextInput, useTheme } from 'react-native-paper';

import type { Category } from '@/features/categories/api';
import { CategoryPicker } from '@/features/transactions/components/CategoryPicker';

import type { PayeeRule } from '../api';

type Props = {
  rule: PayeeRule;
  categories: readonly Category[];
  onDismiss: () => void;
  onSave: (values: { payee: string | null; categoryId: string | null }) => void;
  onDelete: () => void;
};

/** 利用先の対応表の1行を直す・消す。開くたびに作り直す（key を付けて Portal の中に置く） */
export function PayeeRuleDialog({ rule, categories, onDismiss, onSave, onDelete }: Props) {
  const theme = useTheme();
  const [payee, setPayee] = useState(rule.payee ?? '');
  const [categoryId, setCategoryId] = useState(rule.category_id);
  return (
    <Dialog visible onDismiss={onDismiss}>
      <Dialog.Title>{rule.raw_payee}</Dialog.Title>
      <Dialog.ScrollArea style={styles.scrollArea}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
          <TextInput mode="outlined" label="内容" value={payee} onChangeText={setPayee} />
          <CategoryPicker kind={rule.kind} categories={categories} value={categoryId} onChange={setCategoryId} />
        </ScrollView>
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Button textColor={theme.colors.error} onPress={onDelete}>
          削除
        </Button>
        <Button onPress={() => onSave({ payee: payee.trim() || null, categoryId })}>保存</Button>
      </Dialog.Actions>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  scrollArea: { maxHeight: 420, paddingHorizontal: 24 },
  body: { gap: 8 },
});

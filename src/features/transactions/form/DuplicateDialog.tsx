import { Button, Dialog, Text } from 'react-native-paper';

import { formatDay } from '@/lib/date';
import { formatYen } from '@/lib/money';

import type { Transaction } from '../api';
import { TRANSACTION_RULES } from '../transactionRules';

/** 新しい記録で同じ日・同じ金額の記録があったとき、保存する前に確かめる（REQ-17）。Portal の中に置く */
export function DuplicateDialog({
  matches,
  onCancel,
  onSave,
}: {
  matches: readonly Transaction[] | null;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <Dialog visible={matches !== null} onDismiss={onCancel}>
      <Dialog.Title>同じ日・同じ金額の記録があります</Dialog.Title>
      <Dialog.Content>
        {matches?.map((m) => (
          <Text key={m.id} variant="bodyMedium">
            {formatDay(m.date)} {TRANSACTION_RULES[m.type].label} {formatYen(m.amount)}
            {m.payee ? `（${m.payee}）` : ''}
          </Text>
        ))}
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onCancel}>やめる</Button>
        <Button onPress={onSave}>保存する</Button>
      </Dialog.Actions>
    </Dialog>
  );
}

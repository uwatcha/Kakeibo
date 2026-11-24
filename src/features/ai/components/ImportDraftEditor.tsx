import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton, Text, TextInput, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { SectionCard } from '@/components/SectionCard';
import type { Account } from '@/features/accounts/api';
import { usePayeeHistory } from '@/features/transactions/hooks';
import { AccountFields } from '@/features/transactions/form/AccountFields';
import { PayeeField } from '@/features/transactions/form/PayeeField';
import { emptyFormValues, type FormValues } from '@/features/transactions/form/values';
import { amountKindOf, TRANSACTION_RULES } from '@/features/transactions/transactionRules';
import { formatDay } from '@/lib/date';

import type { ImportDraft } from '../extract';

export type DraftPatch = Pick<ImportDraft, 'fromAccountId' | 'toAccountId' | 'payee' | 'memo'>;

type Props = {
  draft: ImportDraft;
  /** 何件目か・全部で何件か（左右の矢印で切り替える） */
  index: number;
  total: number;
  onMove: (step: -1 | 1) => void;
  onChange: (patch: DraftPatch) => void;
  ready: boolean;
  saving: boolean;
  onSave: () => void;
  accounts: readonly Account[];
  balances: ReadonlyMap<string, number> | undefined;
};

/**
 * AI入力で読み取った記録を1件ずつ直す欄（2026-11-24 ユーザーの要望）。上の「< 項目名 >」で直す記録を切り替える。
 * 欄は記録の入力画面と同じ部品（口座・内容・メモ）。入れたものはすぐ一覧の記録に反映し、この記録だけでも保存できる
 */
export function ImportDraftEditor({
  draft,
  index,
  total,
  onMove,
  onChange,
  ready,
  saving,
  onSave,
  accounts,
  balances,
}: Props) {
  const theme = useTheme();
  const payeeHistory = usePayeeHistory();
  const { control, formState, setValue } = useForm<FormValues>({
    defaultValues: {
      ...emptyFormValues(draft.date),
      type: draft.type,
      amount: String(draft.amount),
      fromAccountId: draft.fromAccountId,
      toAccountId: draft.toAccountId,
      categoryId: draft.categoryId,
      payee: draft.payee ?? '',
      memo: draft.memo ?? '',
    },
  });
  const [fromAccountId, toAccountId, payee, memo] = useWatch({
    control,
    name: ['fromAccountId', 'toAccountId', 'payee', 'memo'],
  });
  // 入れたものは、すぐ一覧の記録に反映する（まとめて保存するときにも使う）
  useEffect(() => {
    onChange({ fromAccountId, toAccountId, payee: payee.trim() || null, memo });
    // onChange は描画のたびに変わるので、入れた値が変わったときだけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromAccountId, toAccountId, payee, memo]);

  const title = draft.payee || TRANSACTION_RULES[draft.type].label;
  return (
    <SectionCard>
      <View style={styles.header}>
        <IconButton icon="chevron-left" accessibilityLabel="前の記録" disabled={total < 2} onPress={() => onMove(-1)} />
        <View style={styles.titleBox}>
          <Text variant="titleMedium" numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          <View style={styles.meta}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {`${index + 1}/${total}・${formatDay(draft.date)}・${TRANSACTION_RULES[draft.type].label}`}
            </Text>
            <Amount value={draft.amount} kind={amountKindOf(draft.type)} variant="bodySmall" />
          </View>
        </View>
        <IconButton icon="chevron-right" accessibilityLabel="次の記録" disabled={total < 2} onPress={() => onMove(1)} />
      </View>
      <View style={styles.fields}>
        <AccountFields
          control={control}
          errors={formState.errors}
          type={draft.type}
          accounts={accounts}
          balances={balances}
        />
        <PayeeField
          control={control}
          history={payeeHistory.data ?? []}
          onCommit={(value) => setValue('payee', value)}
        />
        <TextInput
          mode="outlined"
          label="メモ（任意）"
          value={memo}
          onChangeText={(value) => setValue('memo', value)}
          multiline
        />
        <Button mode="contained-tonal" icon="content-save" onPress={onSave} loading={saving} disabled={saving}>
          {/* 口座が決まっていなければ、口座を空にして未確認で保存する */}
          {ready ? 'この記録を保存' : '口座なしで保存（未確認）'}
        </Button>
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingTop: 4 },
  titleBox: { flex: 1, alignItems: 'center' },
  title: { fontWeight: '700' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fields: { padding: 12, paddingTop: 4, gap: 12 },
});

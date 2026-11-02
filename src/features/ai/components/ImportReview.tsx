import { StyleSheet, View } from 'react-native';
import { Button, Checkbox, Text, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { ListRow } from '@/components/ListRow';
import { SectionCard } from '@/components/SectionCard';
import { ASSET_KINDS } from '@/features/accounts/accountKinds';
import type { Account } from '@/features/accounts/api';
import type { Category } from '@/features/categories/api';
import { categoryLabel } from '@/features/categories/tree';
import { AccountPicker } from '@/features/transactions/components/AccountPicker';
import { amountKindOf, TRANSACTION_RULES } from '@/features/transactions/transactionRules';
import { formatDay } from '@/lib/date';

import { draftAccounts, type FallbackAccounts, type ImportDraft, isDraftReady } from '../extract';

type Props = {
  drafts: readonly ImportDraft[];
  selected: ReadonlySet<string>;
  onToggle: (key: string) => void;
  fallback: FallbackAccounts;
  onFallbackChange: (next: FallbackAccounts) => void;
  accounts: readonly Account[];
  categories: readonly Category[];
  balances: ReadonlyMap<string, number> | undefined;
  saving: boolean;
  onSave: () => void;
  onBack: () => void;
};

/**
 * AI入力で読み取った記録の確認。チェックした行だけを記録する。
 * AI が口座を選べなかった行があれば、上で「支払いの口座」「入金の口座」を選ぶ（口座が決まらない行は選べない）
 */
export function ImportReview({
  drafts,
  selected,
  onToggle,
  fallback,
  onFallbackChange,
  accounts,
  categories,
  balances,
  saving,
  onSave,
  onBack,
}: Props) {
  const theme = useTheme();
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name;
  const count = drafts.filter((d) => selected.has(d.key) && isDraftReady(d, fallback)).length;

  return (
    <>
      {drafts.some((d) => d.type === 'expense' && !d.fromAccountId) && (
        <AccountPicker
          label="支払いの口座"
          kinds={TRANSACTION_RULES.expense.from!.kinds}
          accounts={accounts}
          value={fallback.payFrom}
          onChange={(payFrom) => onFallbackChange({ ...fallback, payFrom })}
          balances={balances}
          rows={2}
        />
      )}
      {drafts.some((d) => d.type === 'income' && !d.toAccountId) && (
        <AccountPicker
          label="入金の口座"
          kinds={ASSET_KINDS}
          accounts={accounts}
          value={fallback.payTo}
          onChange={(payTo) => onFallbackChange({ ...fallback, payTo })}
          balances={balances}
          rows={2}
        />
      )}
      <SectionCard title={`読み取った記録（${drafts.length}件）`}>
        {drafts.map((d) => {
          const { fromAccountId, toAccountId } = draftAccounts(d, fallback);
          const where = [accountName(fromAccountId), accountName(toAccountId)].filter(Boolean).join(' → ');
          const ready = isDraftReady(d, fallback);
          return (
            <ListRow
              key={d.key}
              title={d.payee ?? TRANSACTION_RULES[d.type].label}
              subtitle={
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {[
                    formatDay(d.date),
                    // 内訳があれば品目の数（保存すると品目ごとのカテゴリと割引・調整の行になる）
                    d.items?.length
                      ? `内訳 ${d.items.filter((i) => !i.is_adjustment).length}品目`
                      : categoryLabel(d.categoryId, categories),
                    where || '口座なし',
                    d.note,
                  ]
                    .filter(Boolean)
                    .join('・')}
                  {d.duplicate && <Text style={{ color: theme.colors.error }}>・重複の可能性</Text>}
                </Text>
              }
              icon={TRANSACTION_RULES[d.type].icon}
              onPress={() => onToggle(d.key)}
              disabled={!ready}
              right={
                <View style={styles.right}>
                  <Amount value={d.amount} kind={amountKindOf(d.type)} variant="bodyLarge" />
                  <Checkbox status={selected.has(d.key) && ready ? 'checked' : 'unchecked'} />
                </View>
              }
            />
          );
        })}
      </SectionCard>
      <Button mode="contained" icon="content-save" onPress={onSave} loading={saving} disabled={saving || count === 0}>
        {count}件を記録する
      </Button>
      <Button onPress={onBack} disabled={saving}>
        やり直す
      </Button>
    </>
  );
}

const styles = StyleSheet.create({
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});

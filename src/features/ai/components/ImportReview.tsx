import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Checkbox, Text, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { ListRow } from '@/components/ListRow';
import { SectionCard } from '@/components/SectionCard';
import type { Account } from '@/features/accounts/api';
import type { Category } from '@/features/categories/api';
import { categoryLabel } from '@/features/categories/tree';
import { amountKindOf, TRANSACTION_RULES } from '@/features/transactions/transactionRules';
import { formatDay } from '@/lib/date';

import { draftAccounts, type FallbackAccounts, type ImportDraft, isDraftReady } from '../extract';
import { type DraftPatch, ImportDraftEditor } from './ImportDraftEditor';

/** 口座はこの画面で1件ずつ選ぶので、一覧の上でまとめて選ぶ口座は使わない */
const NO_FALLBACK: FallbackAccounts = { payFrom: null, payTo: null };

type Props = {
  drafts: readonly ImportDraft[];
  selected: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onChangeDraft: (key: string, patch: DraftPatch) => void;
  accounts: readonly Account[];
  categories: readonly Category[];
  balances: ReadonlyMap<string, number> | undefined;
  saving: boolean;
  /** チェックした記録をまとめて保存する */
  onSave: () => void;
  /** 1件だけ保存する */
  onSaveOne: (key: string) => void;
  onBack: () => void;
};

/**
 * AI入力で読み取った記録の確認。チェックした記録をまとめて保存する。
 * 口座が決まらなかった記録は、上の欄（ImportDraftEditor）で1件ずつ入れる（「< 項目名 >」で切り替え。2026-11-24
 * ユーザーの要望）。一覧の行を押すと、その記録も上の欄で直せる。入れ終わった記録は、1件ずつでもまとめてでも保存できる
 */
export function ImportReview({
  drafts,
  selected,
  onToggle,
  onChangeDraft,
  accounts,
  categories,
  balances,
  saving,
  onSave,
  onSaveOne,
  onBack,
}: Props) {
  const theme = useTheme();
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name;
  const ready = (d: ImportDraft) => isDraftReady(d, NO_FALLBACK);
  const count = drafts.filter((d) => selected.has(d.key) && ready(d)).length;

  // 上の欄で直す記録: 最初に口座が決まらなかったもの（入れ終わっても残す）と、一覧で押したもの
  const [targets, setTargets] = useState<string[]>(() => drafts.filter((d) => !ready(d)).map((d) => d.key));
  const [current, setCurrent] = useState<string | null>(targets[0] ?? null);
  // 保存して一覧から消えた記録は除く
  const editable = targets.filter((key) => drafts.some((d) => d.key === key));
  const currentKey = current && editable.includes(current) ? current : (editable[0] ?? null);
  const currentDraft = drafts.find((d) => d.key === currentKey) ?? null;
  const position = currentKey ? editable.indexOf(currentKey) : -1;

  const open = (key: string) => {
    if (!targets.includes(key)) setTargets([...targets, key]);
    setCurrent(key);
  };

  return (
    <>
      {currentDraft && (
        <ImportDraftEditor
          // 記録を切り替えたら欄を作り直す（その記録の値で入れ直す）
          key={currentDraft.key}
          draft={currentDraft}
          index={position}
          total={editable.length}
          onMove={(step) => setCurrent(editable[(position + step + editable.length) % editable.length])}
          onChange={(patch) => onChangeDraft(currentDraft.key, patch)}
          ready={ready(currentDraft)}
          saving={saving}
          onSave={() => onSaveOne(currentDraft.key)}
          accounts={accounts}
          balances={balances}
        />
      )}
      <SectionCard title={`読み取った記録（${drafts.length}件）`}>
        {drafts.map((d) => {
          const { fromAccountId, toAccountId } = draftAccounts(d, NO_FALLBACK);
          const where = [accountName(fromAccountId), accountName(toAccountId)].filter(Boolean).join(' → ');
          const isReady = ready(d);
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
                    where,
                    d.note,
                  ]
                    .filter(Boolean)
                    .join('・')}
                  {!isReady && <Text style={{ color: theme.colors.error }}>・口座を選んでください</Text>}
                  {d.duplicate && <Text style={{ color: theme.colors.error }}>・重複の可能性</Text>}
                </Text>
              }
              icon={TRANSACTION_RULES[d.type].icon}
              // 押すと上の欄で直す。保存するかどうかは右のチェックで選ぶ
              onPress={() => open(d.key)}
              right={
                <View style={styles.right}>
                  <Amount value={d.amount} kind={amountKindOf(d.type)} variant="bodyLarge" />
                  <Checkbox
                    status={selected.has(d.key) && isReady ? 'checked' : 'unchecked'}
                    disabled={!isReady}
                    onPress={() => onToggle(d.key)}
                  />
                </View>
              }
              style={d.key === currentKey ? { backgroundColor: theme.colors.secondaryContainer } : undefined}
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

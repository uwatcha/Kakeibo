import { router, Stack, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, IconButton, Portal, SegmentedButtons, Snackbar, Text, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { ListRow } from '@/components/ListRow';
import { QueriesState } from '@/components/QueryState';
import { SectionCard } from '@/components/SectionCard';
import { useAccounts } from '@/features/accounts/hooks';
import {
  useAddDuplicateImport,
  useAutoAdded,
  useDismissImport,
  useMarkReviewed,
  useNeedsPayee,
  useOpenImports,
} from '@/features/emailImport/hooks';
import type { Transaction } from '@/features/transactions/api';
import { useConfirmTransactions, useUnconfirmed } from '@/features/transactions/hooks';
import { amountKindOf, describeAccounts, TRANSACTION_RULES } from '@/features/transactions/transactionRules';
import { formatDay, toTokyoDateString } from '@/lib/date';
import { formatYen } from '@/lib/money';
import { SPACING } from '@/theme';

type ReviewTab = 'unconfirmed' | 'auto' | 'duplicate' | 'payee';

const TABS: { value: ReviewTab; label: string }[] = [
  { value: 'unconfirmed', label: '未確認' },
  { value: 'auto', label: '自動で追加' },
  { value: 'duplicate', label: '重複' },
  { value: 'payee', label: '内容の入力' },
];

const openTransaction = (id: string) => router.push({ pathname: '/transaction/[id]', params: { id } });

/**
 * 確かめる記録をまとめて見る画面（ホームの上のカードから開く。URL の tab で最初のタブ）。
 * - 未確認: 日付が過ぎたのに未確認の記録（予定・定期支払い・給料の予定など）。確認するまで残高・集計に入らない
 * - 自動で追加: メールから自動で入った記録で、まだ見ていないもの（残高にはもう入っている）
 * - 重複: メールから読み取ったが、手入力の記録と重なっていそうで記録しなかったもの
 * - 内容の入力: AI が内容（店名）を決められなかった記録。直すと対応表に覚える
 */
export default function ReviewScreen() {
  const theme = useTheme();
  const { tab: initialTab } = useLocalSearchParams<{ tab?: ReviewTab }>();
  const [tab, setTab] = useState<ReviewTab>(initialTab ?? 'unconfirmed');
  const today = toTokyoDateString();
  const unconfirmed = useUnconfirmed(today);
  const autoAdded = useAutoAdded();
  const open = useOpenImports();
  const needsPayee = useNeedsPayee();
  const accounts = useAccounts();
  const confirm = useConfirmTransactions();
  const reviewed = useMarkReviewed();
  const dismiss = useDismissImport();
  const addDuplicate = useAddDuplicateImport();
  const [confirmAll, setConfirmAll] = useState(false);

  const queries = [unconfirmed, autoAdded, open, needsPayee, accounts];
  if (queries.some((q) => !q.data)) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: '記録の確認' }} />
        <QueriesState queries={queries} />
      </View>
    );
  }

  const duplicates = open.data!.filter((i) => i.status === 'duplicate');
  const counts: Record<ReviewTab, number> = {
    unconfirmed: unconfirmed.data!.length,
    auto: autoAdded.data!.length,
    duplicate: duplicates.length,
    payee: needsPayee.data!.length,
  };
  const busy = confirm.isPending || reviewed.isPending || dismiss.isPending || addDuplicate.isPending;
  const failed = confirm.isError || reviewed.isError || dismiss.isError || addDuplicate.isError;

  const row = (t: Transaction, right?: ReactNode) => (
    <ListRow
      key={t.id}
      title={t.payee || TRANSACTION_RULES[t.type].label}
      subtitle={`${formatDay(t.date)}・${describeAccounts(t, accounts.data!)}`}
      icon={TRANSACTION_RULES[t.type].icon}
      onPress={() => openTransaction(t.id)}
      right={
        <View style={styles.right}>
          <Amount value={t.amount} kind={amountKindOf(t.type)} variant="bodyLarge" />
          {right}
        </View>
      }
    />
  );
  const rowAction = (icon: string, label: string, onPress: () => void) => (
    <IconButton
      icon={icon}
      iconColor={theme.colors.primary}
      accessibilityLabel={label}
      disabled={busy}
      onPress={onPress}
      style={styles.check}
    />
  );
  const empty = (text: string) => (
    <Text variant="bodyMedium" style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
      {text}
    </Text>
  );

  let body: ReactNode;
  if (tab === 'unconfirmed') {
    const items = unconfirmed.data!;
    body =
      items.length === 0 ? (
        empty('未確認の記録はありません')
      ) : (
        <>
          <SectionCard title={`${items.length}件`}>
            {items.map((t) =>
              row(
                t,
                rowAction('check-circle-outline', '確認した', () => confirm.mutate([t.id])),
              ),
            )}
          </SectionCard>
          <Button mode="contained" icon="check-all" onPress={() => setConfirmAll(true)} disabled={busy}>
            すべて確認した
          </Button>
        </>
      );
  } else if (tab === 'auto') {
    const items = autoAdded.data!;
    body =
      items.length === 0 ? (
        empty('見ていない記録はありません')
      ) : (
        <>
          <SectionCard title={`${items.length}件`}>
            {items.map((t) =>
              row(
                t,
                rowAction('eye-check-outline', '見た', () => reviewed.mutate([t.id])),
              ),
            )}
          </SectionCard>
          <Button
            mode="contained"
            icon="eye-check"
            onPress={() => reviewed.mutate(items.map((t) => t.id))}
            disabled={busy}
          >
            すべて見た
          </Button>
        </>
      );
  } else if (tab === 'duplicate') {
    body =
      duplicates.length === 0 ? (
        empty('重複の可能性はありません')
      ) : (
        <SectionCard title={`${duplicates.length}件`}>
          {duplicates.map((i) => (
            <View key={i.id}>
              <ListRow
                title={i.raw_payee ?? 'メールの記録'}
                subtitle={[
                  i.date ? formatDay(i.date) : null,
                  i.duplicate
                    ? `重なっている記録: ${formatDay(i.duplicate.date)} ${i.duplicate.payee ?? ''} ${formatYen(i.duplicate.amount)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join('・')}
                icon="content-duplicate"
                wrap
                onPress={i.duplicate_of ? () => openTransaction(i.duplicate_of!) : undefined}
                right={
                  <Amount
                    value={i.amount ?? 0}
                    kind={i.kind === 'bank_in' ? 'income' : 'expense'}
                    variant="bodyLarge"
                  />
                }
              />
              <View style={styles.actions}>
                <Button compact onPress={() => dismiss.mutate(i.id)} disabled={busy}>
                  追加しない
                </Button>
                <Button compact mode="contained-tonal" onPress={() => addDuplicate.mutate(i.id)} disabled={busy}>
                  追加する
                </Button>
              </View>
            </View>
          ))}
        </SectionCard>
      );
  } else {
    const items = needsPayee.data!;
    body =
      items.length === 0 ? (
        empty('内容を入れる記録はありません')
      ) : (
        <SectionCard title={`${items.length}件`}>{items.map((t) => row(t))}</SectionCard>
      );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: '記録の確認' }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        <SegmentedButtons
          value={tab}
          onValueChange={(v) => setTab(v as ReviewTab)}
          density="small"
          buttons={TABS.map((t) => ({
            value: t.value,
            label: counts[t.value] > 0 ? `${t.label} ${counts[t.value]}` : t.label,
          }))}
        />
      </ScrollView>
      <ScrollView contentContainerStyle={styles.content}>{body}</ScrollView>

      <Portal>
        <Dialog visible={confirmAll} onDismiss={() => setConfirmAll(false)}>
          <Dialog.Title>すべて確認した</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {counts.unconfirmed}件をそのままの金額で確認済みにし、残高と集計に入れます。
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmAll(false)}>キャンセル</Button>
            <Button
              onPress={() => {
                confirm.mutate(unconfirmed.data!.map((t) => t.id));
                setConfirmAll(false);
              }}
            >
              確認した
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar visible={failed} onDismiss={() => [confirm, reviewed, dismiss, addDuplicate].forEach((m) => m.reset())}>
        保存できませんでした
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: { paddingHorizontal: SPACING.screen, paddingVertical: 8 },
  content: { padding: SPACING.screen, paddingTop: 4, gap: SPACING.gap, paddingBottom: 48 },
  empty: { padding: 24, textAlign: 'center' },
  right: { flexDirection: 'row', alignItems: 'center' },
  check: { margin: -4, marginLeft: 4 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: SPACING.row,
    paddingBottom: 8,
  },
});

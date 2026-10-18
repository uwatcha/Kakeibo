import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Divider, FAB, List, Text, useTheme } from 'react-native-paper';

import { QueryState } from '@/components/QueryState';
import { Amount } from '@/components/Amount';
import { ACCOUNT_KIND_INFO, ASSET_KINDS } from '@/features/accounts/accountKinds';
import { BalanceCarousel } from '@/features/accounts/components/BalanceCarousel';
import { useAccountBalances } from '@/features/accounts/hooks';
import { type AccountBalance, isAvailableAccount, summarizeBalances } from '@/features/accounts/summary';
import { useEmployers } from '@/features/employers/hooks';
import { nextPayday } from '@/features/employers/payday';
import { useMovementsAfter } from '@/features/reports/hooks';
import { findShortages } from '@/features/reports/shortage';
import { spendableUntil } from '@/features/reports/spendable';
import { addDays, formatDay, toTokyoDateString } from '@/lib/date';
import { formatYen } from '@/lib/money';

function AccountRow({ account }: { account: AccountBalance }) {
  return (
    <List.Item
      title={account.name}
      left={(props) => <List.Icon {...props} icon={ACCOUNT_KIND_INFO[account.kind].icon} />}
      right={() => <Amount value={account.balance} style={styles.amount} />}
      onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: account.id } })}
    />
  );
}

function Section({ title, total, accounts }: { title: string; total: number; accounts: AccountBalance[] }) {
  if (accounts.length === 0) return null;
  return (
    <Card style={styles.card} mode="contained">
      <Card.Title title={title} right={() => <Amount value={total} style={styles.sectionTotal} />} />
      {accounts.map((a) => (
        <AccountRow key={a.id} account={a} />
      ))}
    </Card>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const { data, isLoading, error, refetch, isRefetching } = useAccountBalances();
  const today = toTokyoDateString();
  const employers = useEmployers();
  const future = useMovementsAfter(today);

  if (!data) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <QueryState isLoading={isLoading} error={error} onRetry={refetch} />
      </View>
    );
  }

  const summary = summarizeBalances(data);
  const hasAccounts = data.some((a) => !a.isArchived);

  // 次の給料日の前日（働き先がなければ月末）までの予定を反映した、使える額
  const next = nextPayday(employers.data?.filter((e) => !e.is_archived) ?? [], today);
  const targets = new Set(data.filter(isAvailableAccount).map((a) => a.id));
  const spendable = future.data
    ? spendableUntil(summary.availableNetWorth, future.data, (id) => targets.has(id), today, next?.date ?? null)
    : null;

  // この先31日の予定で残高がマイナスになる口座（REQ-25）
  const shortages = future.data
    ? findShortages(
        new Map(data.filter((a) => ASSET_KINDS.includes(a.kind) && !a.isArchived).map((a) => [a.id, a.balance])),
        future.data,
        today,
        addDays(today, 31),
      )
    : [];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {shortages.length > 0 && (
          <Card style={styles.card} mode="outlined">
            <Card.Title
              title="足りなくなる口座"
              left={(props) => <List.Icon {...props} icon="alert" color={theme.colors.error} />}
            />
            {shortages.map((s) => (
              <List.Item
                key={s.accountId}
                title={data.find((a) => a.id === s.accountId)?.name}
                description={formatDay(s.date)}
                right={() => <Amount value={s.lowest} style={styles.amount} />}
                onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: s.accountId } })}
              />
            ))}
          </Card>
        )}

        <BalanceCarousel
          pages={[
            { title: '汎用資産', amount: summary.availableNetWorth },
            { title: '純資産', amount: summary.netWorth },
            ...(spendable
              ? [
                  {
                    title: next ? '給料日までに使える額' : '月末までに使える額',
                    amount: spendable.amount,
                    detail: [
                      spendable.perDay !== null ? `1日あたり ${formatYen(spendable.perDay)}` : null,
                      `あと${spendable.daysLeft}日`,
                    ]
                      .filter(Boolean)
                      .join('・'),
                  },
                ]
              : []),
          ]}
        />

        {!hasAccounts && (
          <Card style={styles.card} mode="outlined">
            <Card.Content style={styles.empty}>
              <Text variant="bodyMedium">口座がまだありません</Text>
              <Button
                mode="contained"
                icon="plus"
                onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: 'new' } })}
              >
                口座を追加
              </Button>
            </Card.Content>
          </Card>
        )}

        <Section title="普段使う口座" total={summary.everydayTotal} accounts={summary.everyday} />
        <Section title="クレジットカード" total={0 - summary.creditCardUnpaid} accounts={summary.creditCards} />
        <Section title="貸している・立て替え" total={summary.receivableTotal} accounts={summary.receivables} />
        <Section title="借りている" total={0 - summary.payableTotal} accounts={summary.payables} />

        {summary.reserved.length > 0 && (
          <Card style={styles.card} mode="contained">
            <List.Accordion
              title="普段使わない口座"
              description={formatYen(summary.reservedTotal)}
              style={styles.accordion}
            >
              <Divider />
              {summary.reserved.map((a) => (
                <AccountRow key={a.id} account={a} />
              ))}
            </List.Accordion>
          </Card>
        )}
      </ScrollView>
      {hasAccounts && (
        <FAB
          icon="plus"
          style={styles.fab}
          accessibilityLabel="記録する"
          onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: 'new' } })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 96 },
  card: { overflow: 'hidden' },
  amount: { alignSelf: 'center', fontVariant: ['tabular-nums'] },
  sectionTotal: { marginRight: 16, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  empty: { gap: 12 },
  accordion: { backgroundColor: 'transparent' },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});

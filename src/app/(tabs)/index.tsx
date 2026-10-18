import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Divider, FAB, List, Text, useTheme } from 'react-native-paper';

import { QueryState } from '@/components/QueryState';
import { Amount } from '@/components/Amount';
import { ACCOUNT_KIND_INFO } from '@/features/accounts/accountKinds';
import { BalanceCarousel } from '@/features/accounts/components/BalanceCarousel';
import { useAccountBalances } from '@/features/accounts/hooks';
import { type AccountBalance, summarizeBalances } from '@/features/accounts/summary';
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

  if (!data) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <QueryState isLoading={isLoading} error={error} onRetry={refetch} />
      </View>
    );
  }

  const summary = summarizeBalances(data);
  const hasAccounts = data.some((a) => !a.isArchived);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <BalanceCarousel
          pages={[
            { title: '汎用資産', amount: summary.availableNetWorth },
            { title: '純資産', amount: summary.netWorth },
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

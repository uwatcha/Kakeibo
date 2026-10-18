import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Divider, List, Text, useTheme } from 'react-native-paper';

import { QueryState } from '@/components/QueryState';
import { ACCOUNT_KIND_INFO, isLiability } from '@/features/accounts/accountKinds';
import { useAccountBalances } from '@/features/accounts/hooks';
import { type AccountBalance, summarizeBalances } from '@/features/accounts/summary';
import { formatYen } from '@/lib/money';

function AccountRow({ account }: { account: AccountBalance }) {
  // 負債は「未払い・借りている額」として正の値で見せる
  const shown = isLiability(account.kind) ? 0 - account.balance : account.balance;
  return (
    <List.Item
      title={account.name}
      left={(props) => <List.Icon {...props} icon={ACCOUNT_KIND_INFO[account.kind].icon} />}
      right={() => <Text style={styles.amount}>{formatYen(shown)}</Text>}
      onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: account.id } })}
    />
  );
}

function Section({ title, total, accounts }: { title: string; total: number; accounts: AccountBalance[] }) {
  if (accounts.length === 0) return null;
  return (
    <Card style={styles.card} mode="contained">
      <Card.Title title={title} right={() => <Text style={styles.sectionTotal}>{formatYen(total)}</Text>} />
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
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="labelLarge">純資産</Text>
          <Text variant="displaySmall">{formatYen(summary.netWorth)}</Text>
        </Card.Content>
      </Card>

      {!hasAccounts && (
        <Card style={styles.card} mode="outlined">
          <Card.Content style={styles.empty}>
            <Text variant="bodyMedium">口座がまだありません。財布や銀行口座を登録しましょう。</Text>
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
      <Section title="クレジットカード（未払い）" total={summary.creditCardUnpaid} accounts={summary.creditCards} />
      <Section title="貸している・立て替え" total={summary.receivableTotal} accounts={summary.receivables} />
      <Section title="借りている" total={summary.payableTotal} accounts={summary.payables} />

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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  card: { overflow: 'hidden' },
  amount: { alignSelf: 'center', fontVariant: ['tabular-nums'] },
  sectionTotal: { marginRight: 16, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  empty: { gap: 12 },
  accordion: { backgroundColor: 'transparent' },
});

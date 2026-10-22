import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { IconButton, SegmentedButtons, Text, useTheme } from 'react-native-paper';

import { AddFab } from '@/components/AddFab';
import { Amount } from '@/components/Amount';
import { ListRow } from '@/components/ListRow';
import { QueriesState } from '@/components/QueryState';
import { SectionCard } from '@/components/SectionCard';
import { ACCOUNT_KIND_INFO, isLiability } from '@/features/accounts/accountKinds';
import { cardStatements } from '@/features/accounts/cardStatements';
import { useAccountBalance, useAccounts, useCardSettings } from '@/features/accounts/hooks';
import { useCategories } from '@/features/categories/hooks';
import { TransactionDayList } from '@/features/transactions/components/TransactionDayList';
import { useAccountTransactions } from '@/features/transactions/hooks';
import { formatDay, toTokyoDateString } from '@/lib/date';
import { formatYen } from '@/lib/money';
import { RADIUS, SPACING } from '@/theme';

/** 口座の利用履歴。右上から口座の編集へ */
export default function AccountHistoryScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const accounts = useAccounts();
  const categories = useCategories();
  const balance = useAccountBalance(id);
  const transactions = useAccountTransactions(id);
  const account = accounts.data?.find((a) => a.id === id);
  const isCard = account?.kind === 'credit_card';
  const settings = useCardSettings(id);
  const [view, setView] = useState<'history' | 'statements'>('history');

  const headerRight = () => (
    <IconButton
      icon="pencil"
      accessibilityLabel="口座を編集"
      onPress={() => router.push({ pathname: '/accounts/[id]', params: { id } })}
    />
  );

  if (!account || !categories.data || balance.data === undefined || !transactions.data) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: '口座', headerRight }} />
        <QueriesState queries={[accounts, categories, balance, transactions]} />
      </View>
    );
  }

  const today = toTokyoDateString();
  const statements =
    isCard && settings.data
      ? cardStatements(
          settings.data,
          transactions.data.filter((t) => t.from_account_id === id),
          { unpaid: 0 - account.opening_balance, since: account.created_at.slice(0, 10) },
          today,
        )
      : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: account.name, headerRight }} />
      <SectionCard style={styles.summary}>
        <Text variant="titleMedium" style={styles.bold}>
          {isLiability(account.kind)
            ? ACCOUNT_KIND_INFO[account.kind].openingBalanceLabel.replace('今の', '現在の')
            : '現在の残高'}
        </Text>
        <Amount
          value={isLiability(account.kind) ? 0 - balance.data : balance.data}
          variant="headlineMedium"
          style={styles.balance}
        />
        {account.memo && (
          <Text variant="bodyMedium" style={[styles.memo, { color: theme.colors.onSurfaceVariant }]}>
            {account.memo}
          </Text>
        )}
      </SectionCard>
      {isCard && (
        <SegmentedButtons
          style={styles.segment}
          value={view}
          onValueChange={(v) => setView(v as 'history' | 'statements')}
          buttons={[
            { value: 'history', label: '履歴' },
            { value: 'statements', label: '引き落とし' },
          ]}
        />
      )}

      {view === 'statements' && isCard ? (
        <ScrollView contentContainerStyle={styles.statements}>
          {statements === null ? (
            <SectionCard>
              <ListRow
                title="締め日・引き落とし日"
                icon="calendar-clock"
                onPress={() => router.push({ pathname: '/card-settings/[id]', params: { id } })}
              />
            </SectionCard>
          ) : (
            <SectionCard>
              {statements.map((s) => (
                <ListRow
                  key={s.closingDate}
                  title={formatDay(s.paymentDate)}
                  subtitle={`${formatDay(s.closingDate)}締め${s.isOpen ? '・締め前' : ''}`}
                  icon={s.paymentDate < today ? 'check-circle-outline' : 'calendar-clock'}
                  iconColor={s.paymentDate < today ? theme.colors.onSurfaceVariant : undefined}
                  right={
                    <Text variant="bodyLarge" style={[styles.bold, styles.number]}>
                      {formatYen(s.amount)}
                    </Text>
                  }
                />
              ))}
            </SectionCard>
          )}
        </ScrollView>
      ) : (
        <TransactionDayList
          transactions={transactions.data}
          accounts={accounts.data!}
          categories={categories.data}
          accountId={id}
          viewKey={id}
          emptyText="この口座の記録はありません"
          refreshing={transactions.isRefetching}
          onRefresh={() => {
            transactions.refetch();
            balance.refetch();
          }}
        />
      )}
      {!account.is_archived && (
        <AddFab
          accessibilityLabel={`${account.name}で記録する`}
          onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: 'new', accountId: id } })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summary: { marginHorizontal: SPACING.screen, marginTop: 4, paddingHorizontal: 20, paddingVertical: 14 },
  bold: { fontWeight: '700' },
  number: { fontVariant: ['tabular-nums'] },
  balance: { fontWeight: '800', marginTop: 2 },
  memo: { marginTop: 6 },
  segment: { marginHorizontal: SPACING.screen, marginTop: SPACING.gap, borderRadius: RADIUS.tile },
  statements: { padding: SPACING.screen, paddingBottom: 96 },
});

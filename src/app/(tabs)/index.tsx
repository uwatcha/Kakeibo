import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text, TouchableRipple, useTheme } from 'react-native-paper';

import { AddFab } from '@/components/AddFab';
import { Amount } from '@/components/Amount';
import { ListRow } from '@/components/ListRow';
import { QueryState } from '@/components/QueryState';
import { SectionCard } from '@/components/SectionCard';
import { ACCOUNT_KIND_INFO, ASSET_KINDS } from '@/features/accounts/accountKinds';
import { AvailableAccountsSheet } from '@/features/accounts/components/AvailableAccountsSheet';
import { BalanceCarousel } from '@/features/accounts/components/BalanceCarousel';
import { useAccountBalances } from '@/features/accounts/hooks';
import { type AccountBalance, isAvailableAccount, summarizeBalances } from '@/features/accounts/summary';
import { useEmployers } from '@/features/employers/hooks';
import { nextPayday } from '@/features/employers/payday';
import type { Movement } from '@/features/reports/api';
import { useMovementsAfter } from '@/features/reports/hooks';
import { findShortages } from '@/features/reports/shortage';
import { monthEnd, plannedEffect, spendableUntil } from '@/features/reports/spendable';
import { TRANSACTION_RULES } from '@/features/transactions/transactionRules';
import { addDays, formatDay, toTokyoDateString } from '@/lib/date';
import { formatYen } from '@/lib/money';
import { SPACING } from '@/theme';

function AccountRow({ account }: { account: AccountBalance }) {
  return (
    <ListRow
      title={account.name}
      icon={ACCOUNT_KIND_INFO[account.kind].icon}
      right={<Amount value={account.balance} variant="bodyLarge" />}
      onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: account.id } })}
    />
  );
}

function Section({ title, total, accounts }: { title: string; total: number; accounts: AccountBalance[] }) {
  if (accounts.length === 0) return null;
  return (
    <SectionCard title={title} right={<Amount value={total} variant="titleMedium" style={styles.total} />}>
      {accounts.map((a) => (
        <AccountRow key={a.id} account={a} />
      ))}
    </SectionCard>
  );
}

/** 普段使わない口座。見出しを押すと開く */
function ReservedSection({ total, accounts }: { total: number; accounts: AccountBalance[] }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  if (accounts.length === 0) return null;
  return (
    <SectionCard>
      <TouchableRipple onPress={() => setOpen(!open)} accessibilityState={{ expanded: open }}>
        <View style={styles.collapsibleHeader}>
          <Text variant="titleMedium" style={styles.total}>
            普段使わない口座
          </Text>
          <MaterialCommunityIcons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={22}
            color={theme.colors.onSurfaceVariant}
            style={styles.collapsibleIcon}
          />
          {/* 合計は他のカードの合計と右端をそろえる */}
          <Amount value={total} variant="titleMedium" style={styles.total} />
        </View>
      </TouchableRipple>
      {open && accounts.map((a) => <AccountRow key={a.id} account={a} />)}
    </SectionCard>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const { data, isLoading, error, refetch, isRefetching } = useAccountBalances();
  const today = toTokyoDateString();
  const employers = useEmployers();
  const future = useMovementsAfter(today);
  const [showAvailable, setShowAvailable] = useState(false);

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
  // 月末の見込み（REQ-20）: 汎用資産に月末までの予定（給料日の入金も含む）を反映した額
  const monthEndForecast = future.data
    ? summary.availableNetWorth + plannedEffect(future.data, (id) => targets.has(id), today, monthEnd(today))
    : null;

  const openTransaction = (id: string) => router.push({ pathname: '/transaction/[id]', params: { id } });
  const accountName = (id: string | null) => data.find((a) => a.id === id)?.name ?? '';
  // 支払い先が口座（クレカ・貸し借りの相手）ならその名前、なければ内容、それもなければ記録の種類
  const causeLabel = (m: Movement) =>
    (m.to_account_id ? accountName(m.to_account_id) : null) || m.payee || TRANSACTION_RULES[m.type].label;

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
          <SectionCard
            title="足りなくなる口座"
            left={<MaterialCommunityIcons name="alert" size={22} color={theme.colors.error} />}
          >
            {shortages.map((s) => (
              <ListRow
                key={s.accountId}
                title={accountName(s.accountId)}
                subtitle={
                  <View>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {formatDay(s.date)}
                    </Text>
                    {/* その日に足りなくなる原因の支払い */}
                    {/* 原因が複数あるときは、それぞれの行を押すとその予定を開く */}
                    {s.causes.map((m) => (
                      <Text
                        key={m.id}
                        variant="bodySmall"
                        numberOfLines={1}
                        onPress={s.causes.length > 1 ? () => openTransaction(m.id) : undefined}
                      >
                        {causeLabel(m)} {formatYen(m.amount)}
                      </Text>
                    ))}
                  </View>
                }
                right={<Amount value={s.lowest} variant="bodyLarge" />}
                // 足りなくなる原因の支払い予定を開く（複数なら一番大きいもの）
                onPress={() => {
                  const main = [...s.causes].sort((a, b) => b.amount - a.amount)[0];
                  if (main) openTransaction(main.id);
                  else router.push({ pathname: '/accounts/[id]', params: { id: s.accountId } });
                }}
              />
            ))}
          </SectionCard>
        )}

        <BalanceCarousel
          pages={[
            {
              title: '汎用資産',
              amount: summary.availableNetWorth,
              action: { icon: 'tune-variant', label: '汎用資産に含める口座', onPress: () => setShowAvailable(true) },
            },
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
            ...(monthEndForecast !== null ? [{ title: '月末の見込み', amount: monthEndForecast }] : []),
          ]}
        />

        {!hasAccounts && (
          <SectionCard style={styles.empty}>
            <Text variant="bodyMedium">口座がまだありません</Text>
            <Button
              mode="contained"
              icon="plus"
              onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: 'new' } })}
            >
              口座を追加
            </Button>
          </SectionCard>
        )}

        <Section title="普段使う口座" total={summary.everydayTotal} accounts={summary.everyday} />
        <Section title="クレジットカード" total={0 - summary.creditCardUnpaid} accounts={summary.creditCards} />
        <Section title="貸している・立て替え" total={summary.receivableTotal} accounts={summary.receivables} />
        <Section title="借りている" total={0 - summary.payableTotal} accounts={summary.payables} />

        <ReservedSection total={summary.reservedTotal} accounts={summary.reserved} />
      </ScrollView>
      {hasAccounts && (
        <AddFab
          accessibilityLabel="記録する"
          onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: 'new' } })}
        />
      )}
      <AvailableAccountsSheet visible={showAvailable} onDismiss={() => setShowAvailable(false)} accounts={data} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: SPACING.screen, paddingTop: 4, gap: SPACING.gap, paddingBottom: 96 },
  total: { fontWeight: '700' },
  empty: { gap: 12, padding: 16 },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.row,
    paddingVertical: 10,
  },
  collapsibleIcon: { flex: 1 },
});

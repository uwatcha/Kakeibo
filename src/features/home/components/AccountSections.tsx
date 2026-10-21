import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { ListRow } from '@/components/ListRow';
import { SectionCard } from '@/components/SectionCard';
import { ACCOUNT_KIND_INFO } from '@/features/accounts/accountKinds';
import type { AccountBalance, BalanceSummary } from '@/features/accounts/summary';
import { SPACING } from '@/theme';

function AccountRow({ account }: { account: AccountBalance }) {
  return (
    <ListRow
      title={account.name}
      icon={ACCOUNT_KIND_INFO[account.kind].icon}
      right={<Amount value={account.balance} variant="bodyLarge" />}
      onPress={() => router.push({ pathname: '/account-history/[id]', params: { id: account.id } })}
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

/** ホームの口座の一覧（普段使う口座・クレカ・貸し借り・普段使わない口座）。押すと利用履歴 */
export function AccountSections({ summary }: { summary: BalanceSummary }) {
  return (
    <>
      <Section title="普段使う口座" total={summary.everydayTotal} accounts={summary.everyday} />
      <Section title="クレジットカード" total={0 - summary.creditCardUnpaid} accounts={summary.creditCards} />
      {/* 精算が済んで 0 円の相手はホームに出さない（口座の管理の「過去の相手」から開ける） */}
      <Section
        title="貸している・立て替え"
        total={summary.receivableTotal}
        accounts={summary.receivables.filter((a) => a.balance !== 0)}
      />
      <Section
        title="借りている"
        total={0 - summary.payableTotal}
        accounts={summary.payables.filter((a) => a.balance !== 0)}
      />
      <ReservedSection total={summary.reservedTotal} accounts={summary.reserved} />
    </>
  );
}

const styles = StyleSheet.create({
  total: { fontWeight: '700' },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.row,
    paddingVertical: 10,
  },
  collapsibleIcon: { flex: 1 },
});

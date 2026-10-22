import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';

import { AddFab } from '@/components/AddFab';
import { QueryState } from '@/components/QueryState';
import { SectionCard } from '@/components/SectionCard';
import { BalanceCarousel } from '@/features/home/components/BalanceCarousel';
import { BreakdownSheet } from '@/features/home/components/BreakdownSheet';
import { homeSheet, type HomeSheetKey } from '@/features/home/breakdown';
import { AccountSections } from '@/features/home/components/AccountSections';
import { ReviewCard } from '@/features/home/components/ReviewCard';
import { ShortageCard } from '@/features/home/components/ShortageCard';
import { type HomeBudget, shortfallTitle, untilPaydayLabel } from '@/features/home/figures';
import { useHomeFigures } from '@/features/home/hooks';
import { formatDay, toTokyoDateString } from '@/lib/date';
import { formatYen } from '@/lib/money';
import { SPACING } from '@/theme';

/**
 * 給料日までに使える額のカード。マイナスなら「足りない額」に言い換えて正の数を赤で出し、元の見出しを取り消し線で残す。
 * カードの下に、2か月先は見ずに次の給料日まで乗り切れるかの額
 */
function budgetPage(budget: HomeBudget, onPress: () => void) {
  const short = budget.result.amount < 0;
  const until = untilPaydayLabel(budget);
  return {
    title: short ? shortfallTitle(budget) : budget.title,
    replacedTitle: short ? budget.title : undefined,
    tone: short ? ('negative' as const) : undefined,
    amount: Math.abs(budget.result.amount),
    detail: [budget.perDay !== null ? `1日あたり ${formatYen(budget.perDay)}` : null, `あと${budget.daysLeft}日`]
      .filter(Boolean)
      .join('・'),
    sub: { label: until.label, amount: until.amount, tone: until.short ? ('negative' as const) : undefined },
    onPress,
  };
}

export default function HomeScreen() {
  const theme = useTheme();
  const today = toTokyoDateString();
  const { balances, future, figures } = useHomeFigures(today);
  // 「メールの読み取りが止まっています」の判定に使う（開いた時点の時刻）
  const [now] = useState(() => Date.now());
  // 押したカードの内訳を出す
  const [breakdown, setBreakdown] = useState<HomeSheetKey | null>(null);

  if (!balances.data || !figures) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <QueryState isLoading={balances.isLoading} error={balances.error} onRetry={balances.refetch} />
      </View>
    );
  }

  const accounts = balances.data;
  const { summary, available, budget } = figures;
  const hasAccounts = accounts.some((a) => !a.isArchived);
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '';
  const openSheet = breakdown ? homeSheet(breakdown, figures, accounts, future.data, today) : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={balances.isRefetching} onRefresh={balances.refetch} />}
      >
        {/* 未確認の記録・メールから自動で入った記録など、確かめるもの */}
        <ReviewCard today={today} now={now} />

        <ShortageCard shortages={figures.shortages} covers={figures.covers} accountName={accountName} />

        <BalanceCarousel
          pages={[
            {
              title: '実質残高',
              amount: available.amount,
              detail: available.cardHorizon ? `${formatDay(available.cardHorizon)}までの予定を含む` : undefined,
              onPress: () => setBreakdown('available'),
            },
            { title: '純資産', amount: summary.netWorth, onPress: () => setBreakdown('net') },
            ...(budget ? [budgetPage(budget, () => setBreakdown('spendable'))] : []),
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

        <AccountSections summary={summary} />
      </ScrollView>
      {hasAccounts && (
        <AddFab
          accessibilityLabel="記録する"
          onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: 'new' } })}
        />
      )}
      {openSheet && (
        <BreakdownSheet
          visible
          onDismiss={() => setBreakdown(null)}
          title={openSheet.title}
          total={openSheet.total}
          sections={openSheet.sections}
          note={openSheet.note}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: SPACING.screen, paddingTop: 4, gap: SPACING.gap, paddingBottom: 96 },
  empty: { gap: 12, padding: 16 },
});

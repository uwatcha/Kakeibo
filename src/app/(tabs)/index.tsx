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
import { budgetCard, type BudgetCardKey, type HomeBudget } from '@/features/home/figures';
import { useHomeFigures } from '@/features/home/hooks';
import { toTokyoDateString } from '@/lib/date';
import { formatYen } from '@/lib/money';
import { SPACING } from '@/theme';

/**
 * 給料日までの3つのカード（給料日までに残る額・取り置き後に使える額・自由に使える額）。
 * マイナスなら「〜に足りない額」に言い換えて正の数を赤で出し、元の見出しを取り消し線で残す
 */
function budgetPage(budget: HomeBudget, key: BudgetCardKey, onPress: () => void) {
  const card = budgetCard(budget, key);
  const short = card.amount < 0;
  // 1日あたりは、給料日までに残る額と自由に使える額だけ（日割りで使う額なので）
  const perDay = key !== 'afterReserve' && card.amount > 0 ? Math.floor(card.amount / budget.daysLeft) : null;
  return {
    title: short ? card.shortTitle : card.title,
    replacedTitle: short ? card.title : undefined,
    tone: short ? ('negative' as const) : undefined,
    amount: Math.abs(card.amount),
    detail: [perDay !== null ? `1日あたり ${formatYen(perDay)}` : null, `あと${budget.daysLeft}日`]
      .filter(Boolean)
      .join('・'),
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
            { title: '実質残高', amount: available.amount, onPress: () => setBreakdown('available') },
            { title: '純資産', amount: summary.netWorth, onPress: () => setBreakdown('net') },
            ...(budget
              ? (['untilPayday', 'afterReserve', 'free'] as const).map((key) =>
                  budgetPage(budget, key, () => setBreakdown(key)),
                )
              : []),
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

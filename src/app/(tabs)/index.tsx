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
import {
  type BreakdownRow,
  type BreakdownSection,
  BreakdownSheet,
} from '@/features/accounts/components/BreakdownSheet';
import { BalanceCarousel } from '@/features/accounts/components/BalanceCarousel';
import { useAccountBalances, useAllCardSettings } from '@/features/accounts/hooks';
import {
  type AccountBalance,
  availableBreakdown,
  isAvailableAccount,
  summarizeBalances,
  transferOrder,
} from '@/features/accounts/summary';
import { useEmployers } from '@/features/employers/hooks';
import { allPaidDays, nextPayday } from '@/features/employers/payday';
import { monthsLater } from '@/features/employers/salarySchedule';
import { useDailyLiving } from '@/features/settings/hooks';
import { paymentDateOf } from '@/features/accounts/cardStatements';
import type { Movement } from '@/features/reports/api';
import { useMovementsAfter } from '@/features/reports/hooks';
import { findShortages, lowestAhead, planCovers, type ShortageCover } from '@/features/reports/shortage';
import { type Budget, computeBudget } from '@/features/reports/budget';
import { lastCardPayment, plannedEffect } from '@/features/reports/spendable';
import { useUnconfirmed } from '@/features/transactions/hooks';
import { TRANSACTION_RULES } from '@/features/transactions/transactionRules';
import { addDays, addMonths, formatDay, monthStart, toTokyoDateString } from '@/lib/date';
import { formatYen } from '@/lib/money';
import { cautionColor, SPACING, warningColors } from '@/theme';

/** 予定を見る期間の終わり（期限なし） */
const LAST_DATE = '9999-12-31';

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

export default function HomeScreen() {
  const theme = useTheme();
  const { data, isLoading, error, refetch, isRefetching } = useAccountBalances();
  const today = toTokyoDateString();
  // 押したカードの内訳を出す
  const [breakdown, setBreakdown] = useState<'available' | 'net' | 'spendable' | null>(null);
  const employers = useEmployers();
  const future = useMovementsAfter(today);
  const unconfirmed = useUnconfirmed(today);
  const cardSettings = useAllCardSettings();
  const living = useDailyLiving(today);
  // 今の給料期間（前回の給料日から）のクレカの利用を数えるため、その前日より後の記録を読む
  const activeEmployers = employers.data?.filter((e) => !e.is_archived) ?? [];
  // 期間は「すべての給料をもらい終えた日」（月ごとにいちばん遅い給料日）で区切る。今の期間はその最後の日から
  const periodStart = allPaidDays(activeEmployers, addDays(today, -70), today).at(-1) ?? monthStart(today);
  const periodMovements = useMovementsAfter(addDays(periodStart, -1));

  if (!data) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <QueryState isLoading={isLoading} error={error} onRetry={refetch} />
      </View>
    );
  }

  const summary = summarizeBalances(data);
  const hasAccounts = data.some((a) => !a.isArchived);

  const next = nextPayday(activeEmployers, today);
  const targets = new Set(data.filter(isAvailableAccount).map((a) => a.id));
  // 実質残高: 含めるクレカのいちばん後の引き落としの予定日までの、ほかの予定（支出・収入）も含める
  // （クレカの未払いは引き落としで消える前提なので、それまでの予定も合わせて見る）
  const includedCards = new Set(data.filter((a) => a.kind === 'credit_card' && isAvailableAccount(a)).map((a) => a.id));
  const cardHorizon = future.data ? lastCardPayment(future.data, (id) => includedCards.has(id), today) : null;
  const availablePlanned =
    future.data && cardHorizon ? plannedEffect(future.data, (id) => targets.has(id), today, cardHorizon) : 0;
  const availableAmount = summary.availableNetWorth + availablePlanned;

  // ===== 給料日までに使える額・給料日前の見込み（reports/budget.ts の computeBudget）=====
  // 資産の口座（現金・銀行など。実質残高に含めるもの）と、含めるクレカ
  const cashAccounts = data.filter((a) => isAvailableAccount(a) && ASSET_KINDS.includes(a.kind) && !a.isArchived);
  const cashIds = new Set(cashAccounts.map((a) => a.id));
  const cashBalance = cashAccounts.reduce((sum, a) => sum + a.balance, 0);
  // 期間の区切り: すべての給料をもらい終える日（無ければ月初め）を、次から3つ
  const paydaysOf = (list: typeof activeEmployers): string[] => {
    if (list.length === 0) {
      const first = addMonths(monthStart(today), 1);
      return [first, addMonths(first, 1), addMonths(first, 2)];
    }
    return allPaidDays(list, today, monthsLater(today, 4)).slice(0, 3);
  };
  // 今の期間（前回の給料日から今日まで）に、含めるクレカで使った額と、それが引き落とされる日
  const currentCardUsage = (periodMovements.data ?? [])
    .filter(
      (m) =>
        !m.overdue &&
        m.date >= periodStart &&
        m.date <= today &&
        !!m.from_account_id &&
        includedCards.has(m.from_account_id),
    )
    .map((m) => {
      const schedule = cardSettings.data?.find((c) => c.account_id === m.from_account_id);
      return { amount: m.amount, paymentDate: schedule ? paymentDateOf(schedule, m.date) : null };
    });
  const budgetFor = (paydays: string[]) =>
    future.data && periodMovements.data && cardSettings.data && living.ready && paydays.length > 0
      ? computeBudget({
          today,
          cashBalance,
          movements: future.data,
          isCash: (id) => cashIds.has(id),
          paydays,
          currentCardUsage,
          dailyLiving: living.daily,
        })
      : null;
  const spendablePaydays = paydaysOf(activeEmployers);
  const spendable = budgetFor(spendablePaydays);
  const spendableThrough = spendablePaydays.length > 0 ? addDays(spendablePaydays[0], -1) : today;
  const daysLeft = Math.max(1, Math.round((Date.parse(spendableThrough) - Date.parse(today)) / 86_400_000) + 1);
  const perDay = spendable && spendable.amount > 0 ? Math.floor(spendable.amount / daysLeft) : null;

  const spendableTitle = next ? '給料日までに使える額' : '月末までに使える額';
  /** マイナスになったときの言い換え（「給料日までに使える額」→「給料日までに足りない額」など） */
  const SHORTFALL_TITLES: Record<string, string> = {
    給料日までに使える額: '給料日までに足りない額',
    月末までに使える額: '月末までに足りない額',
  };
  // 使える額・見込みのカード。マイナスなら「足りない額」に言い換えて正の数を赤で出し、元の見出しを取り消し線で残す
  const budgetPage = (budget: Budget, title: string, showPerDay: boolean, sheet: 'spendable', detail?: string) => {
    const short = budget.amount < 0;
    return {
      title: short ? SHORTFALL_TITLES[title] : title,
      replacedTitle: short ? title : undefined,
      tone: short ? ('negative' as const) : undefined,
      amount: short ? 0 - budget.amount : budget.amount,
      detail:
        detail ??
        [showPerDay && perDay !== null ? `1日あたり ${formatYen(perDay)}` : null, `あと${daysLeft}日`]
          .filter(Boolean)
          .join('・'),
      onPress: () => setBreakdown(sheet),
    };
  };

  // ===== カードの内訳 =====
  const accountRows = (list: readonly AccountBalance[]): BreakdownRow[] =>
    list.map((a) => ({
      key: a.id,
      icon: ACCOUNT_KIND_INFO[a.kind].icon,
      title: a.name,
      amount: a.balance,
      kind: 'balance',
    }));
  // 今日より後、through までの予定のうち、実質残高に含める口座の残高を動かすもの（含める口座どうしの振替は入れない）
  const plannedRows = (through: string, set: ReadonlySet<string>): BreakdownRow[] =>
    (future.data ?? [])
      .filter((m) => m.date > today && m.date <= through)
      .map((m) => ({
        m,
        effect:
          (m.to_account_id && set.has(m.to_account_id) ? m.amount : 0) -
          (m.from_account_id && set.has(m.from_account_id) ? m.amount : 0),
      }))
      .filter(({ effect }) => effect !== 0)
      .sort((a, b) => a.m.date.localeCompare(b.m.date))
      .map(({ m, effect }) => ({
        key: m.id,
        icon: TRANSACTION_RULES[m.type].icon,
        title: m.payee || TRANSACTION_RULES[m.type].label,
        subtitle: formatDay(m.date),
        amount: effect,
        kind: 'delta',
      }));
  const plannedSection = (through: string, total: number, set: ReadonlySet<string>): BreakdownSection => ({
    title: `予定（${formatDay(through)}まで）`,
    total,
    rows: plannedRows(through, set),
  });
  const livingNote = `生活費 1日 ${formatYen(living.daily)}（${living.manual !== null ? '設定した額' : '記録からの見積もり'}）`;
  // 給料日までに使える額・給料日前の見込みの内訳
  const budgetSections = (budget: Budget, through: string): BreakdownSection[] => [
    {
      title: '今の残高（現金・銀行など）',
      total: cashBalance,
      rows: accountRows(cashAccounts.filter((a) => a.balance !== 0).sort((a, b) => b.balance - a.balance)),
    },
    plannedSection(through, budget.planned, cashIds),
    {
      title: '今の期間のクレカの利用',
      total: 0 - budget.cardUsage,
      rows:
        budget.cardUsage > 0
          ? [
              {
                key: 'card',
                icon: 'credit-card',
                title: '給料日の後に引き落とされる分',
                amount: 0 - budget.cardUsage,
                kind: 'delta',
              },
            ]
          : [],
    },
    {
      title: '取り置き（先の給料で足りない分）',
      total: 0 - budget.reserve,
      rows: budget.shortfalls.map((f) => ({
        key: f.from,
        icon: 'piggy-bank-outline',
        title: `${formatDay(f.from)}〜${formatDay(f.to)}の不足`,
        amount: 0 - f.amount,
        kind: 'delta',
      })),
    },
  ];
  const available = availableBreakdown(data);
  const assets = data.filter((a) => a.balance > 0).sort((a, b) => b.balance - a.balance);
  const debts = data.filter((a) => a.balance < 0).sort((a, b) => a.balance - b.balance);
  type Sheet = { title: string; total: number; sections: BreakdownSection[]; note?: string };
  const sheets: Record<'available' | 'net' | 'spendable', Sheet | null | false> = {
    available: {
      title: '実質残高',
      total: availableAmount,
      sections: [
        { title: 'プラスの口座', total: available.plusTotal, rows: accountRows(available.plus) },
        { title: 'マイナスの口座', total: available.minusTotal, rows: accountRows(available.minus) },
        ...(cardHorizon ? [plannedSection(cardHorizon, availablePlanned, targets)] : []),
      ],
    },
    net: {
      title: '純資産',
      total: summary.netWorth,
      sections: [
        { title: '資産', total: assets.reduce((t, a) => t + a.balance, 0), rows: accountRows(assets) },
        { title: '負債', total: debts.reduce((t, a) => t + a.balance, 0), rows: accountRows(debts) },
      ],
    },
    spendable: spendable && {
      title: spendableTitle,
      total: spendable.amount,
      note: [perDay !== null ? `1日あたり ${formatYen(perDay)}（あと${daysLeft}日）` : null, livingNote]
        .filter(Boolean)
        .join('・'),
      sections: budgetSections(spendable, spendableThrough),
    },
  };
  const openSheet = breakdown ? sheets[breakdown] || null : null;

  const openTransaction = (id: string) => router.push({ pathname: '/transaction/[id]', params: { id } });
  const accountName = (id: string | null) => data.find((a) => a.id === id)?.name ?? '';
  // 支払い先が口座（クレカ・貸し借りの相手）ならその名前、なければ内容、それもなければ記録の種類
  const causeLabel = (m: Movement) =>
    (m.to_account_id ? accountName(m.to_account_id) : null) || m.payee || TRANSACTION_RULES[m.type].label;

  // 入っている予定（来月以降も含めて全部）で残高がマイナスになる口座（REQ-25）
  const assetBalances = new Map(
    data.filter((a) => ASSET_KINDS.includes(a.kind) && !a.isArchived).map((a) => [a.id, a.balance]),
  );
  const shortages = future.data ? findShortages(assetBalances, future.data, today, LAST_DATE) : [];
  // ほかの口座からの振替で切り抜けられるか。振替元は「振替の優先度」の画面で「振替に使う」にした口座で、上から順に使う
  const transferSources = transferOrder(data);
  const covers =
    future.data && shortages.length > 0
      ? planCovers(shortages, lowestAhead(assetBalances, future.data, today), transferSources)
      : new Map<string, ShortageCover>();
  const anyAbsolute = shortages.some((s) => !covers.get(s.accountId)?.covered);
  const caution = cautionColor(theme.dark);
  const openTransfer = (from: string, to: string, amount: number) =>
    router.push({
      pathname: '/transaction/[id]',
      params: { id: 'new', transferFrom: from, transferTo: to, amount: String(amount) },
    });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {/* 日付が過ぎたのに未確認の記録（確認するまで残高に入らない） */}
        {(unconfirmed.data?.length ?? 0) > 0 && (
          <SectionCard>
            <ListRow
              title={`未確認の記録 ${unconfirmed.data!.length}件`}
              icon="alert-circle-outline"
              iconColor={warningColors(theme.dark).color}
              right={<MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />}
              onPress={() => router.push('/unconfirmed')}
            />
          </SectionCard>
        )}

        {shortages.length > 0 && (
          <SectionCard
            title="足りなくなる口座"
            // どこから振り替えても足りない口座があれば赤、振替で切り抜けられるものだけなら黄色
            left={
              <MaterialCommunityIcons
                name={anyAbsolute ? 'alert' : 'alert-outline'}
                size={22}
                color={anyAbsolute ? theme.colors.error : caution}
              />
            }
          >
            {shortages.map((s) => {
              const cover = covers.get(s.accountId);
              const covered = !!cover?.covered;
              return (
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
                      {/* 振替で切り抜けられるときは、どこからいくら振り替えるか。押すとその振替を記録する画面 */}
                      {covered &&
                        cover!.sources.map((src) => (
                          <Text
                            key={src.accountId}
                            variant="bodySmall"
                            numberOfLines={1}
                            style={[styles.transfer, { color: caution }]}
                            onPress={() => openTransfer(src.accountId, s.accountId, src.amount)}
                          >
                            {accountName(src.accountId)}から {formatYen(src.amount)} を振替
                          </Text>
                        ))}
                    </View>
                  }
                  right={
                    <Amount
                      value={s.lowest}
                      variant="bodyLarge"
                      style={covered ? [styles.total, { color: caution }] : styles.total}
                    />
                  }
                  // 足りなくなる原因の支払い予定を開く（複数なら一番大きいもの）
                  onPress={() => {
                    const main = [...s.causes].sort((a, b) => b.amount - a.amount)[0];
                    if (main) openTransaction(main.id);
                    else router.push({ pathname: '/accounts/[id]', params: { id: s.accountId } });
                  }}
                />
              );
            })}
          </SectionCard>
        )}

        <BalanceCarousel
          pages={[
            {
              title: '実質残高',
              amount: availableAmount,
              detail: cardHorizon ? `${formatDay(cardHorizon)}までの予定を含む` : undefined,
              onPress: () => setBreakdown('available'),
            },
            { title: '純資産', amount: summary.netWorth, onPress: () => setBreakdown('net') },
            ...(spendable ? [budgetPage(spendable, spendableTitle, true, 'spendable')] : []),
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
  total: { fontWeight: '700' },
  transfer: { fontWeight: '700' },
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

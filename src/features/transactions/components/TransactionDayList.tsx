import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useRef } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { ListRow } from '@/components/ListRow';
import { SectionCard } from '@/components/SectionCard';
import { StatusBadge } from '@/components/StatusBadge';
import type { Account } from '@/features/accounts/api';
import type { Category } from '@/features/categories/api';
import { categoryIcon } from '@/features/categories/icons';
import { categoryLabel } from '@/features/categories/tree';
import { formatDay, toTokyoDateString } from '@/lib/date';
import { formatYen } from '@/lib/money';
import { positiveColor, positiveContainer, SPACING } from '@/theme';

import type { Transaction } from '../api';
import { recordStatus } from '../confirmation';
import { dayExpense, type DaySection, groupByDate } from '../list';
import { TRANSACTION_RULES } from '../transactionRules';

function describeAccounts(t: Transaction, accounts: readonly Account[]): string {
  const name = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '';
  if (t.from_account_id && t.to_account_id) return `${name(t.from_account_id)} → ${name(t.to_account_id)}`;
  if (t.type === 'adjustment')
    return `${name(t.from_account_id ?? t.to_account_id)}（${t.to_account_id ? '増' : '減'}）`;
  return name(t.from_account_id ?? t.to_account_id);
}

type RowContext = {
  accounts: readonly Account[];
  categories: readonly Category[];
  /** 口座の履歴で使う。その口座から見た増減（入ってきたら +、出ていったら −）で金額を出す */
  accountId?: string;
};

function TransactionRow({
  transaction: t,
  accounts,
  categories,
  accountId,
}: RowContext & { transaction: Transaction }) {
  const theme = useTheme();
  const rule = TRANSACTION_RULES[t.type];
  const unconfirmed = recordStatus(t, toTokyoDateString()) === 'unconfirmed';
  const isFlow = t.type === 'expense' || t.type === 'income';
  const category = isFlow ? (categoryLabel(t.category_id, categories) ?? `${rule.label}（未分類）`) : rule.label;
  // 内容があればそれを主にし、カテゴリ（種類）と口座は小さく下に出す
  const title = t.payee || category;
  const subtitle = [t.payee ? category : null, describeAccounts(t, accounts)].filter(Boolean).join('・');
  // 収支に入る記録だけ符号を付ける（振替・貸し借りなどは自分のお金の置き場所が変わるだけなので符号なし）
  const kind = t.type === 'income' ? 'income' : t.type === 'expense' ? 'expense' : 'neutral';
  const icon = isFlow ? categoryIcon(t.category_id, categories, rule.icon) : rule.icon;
  const iconColors =
    kind === 'income'
      ? { background: positiveContainer(theme.dark), color: positiveColor(theme.dark) }
      : kind === 'expense'
        ? { background: theme.colors.primaryContainer, color: theme.colors.primary }
        : { background: theme.colors.surfaceVariant, color: theme.colors.onSurfaceVariant };

  return (
    <ListRow
      title={title}
      subtitle={
        <View style={styles.subtitle}>
          {unconfirmed && <StatusBadge status="unconfirmed" />}
          {t.recurring_rule_id && (
            <MaterialCommunityIcons
              name="autorenew"
              size={14}
              color={theme.colors.onSurfaceVariant}
              accessibilityLabel="定期"
            />
          )}
          <Text
            variant="bodySmall"
            numberOfLines={1}
            style={[styles.subtitleText, { color: theme.colors.onSurfaceVariant }]}
          >
            {subtitle}
          </Text>
        </View>
      }
      icon={icon}
      iconBackground={iconColors.background}
      iconColor={iconColors.color}
      right={
        accountId ? (
          <Amount
            value={t.to_account_id === accountId ? t.amount : 0 - t.amount}
            kind="delta"
            variant="bodyLarge"
            style={styles.amount}
          />
        ) : (
          <Amount value={t.amount} kind={kind} variant="bodyLarge" style={styles.amount} />
        )
      }
      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: t.id } })}
    />
  );
}

/** 1日分の記録を1枚のカードにまとめる */
function DayCard({ section, planned = false, ...context }: RowContext & { section: DaySection; planned?: boolean }) {
  const theme = useTheme();
  const expense = dayExpense(section);
  return (
    <View style={styles.day}>
      <View style={styles.dayHeader}>
        <Text variant="labelLarge" style={[styles.dayLabel, { color: theme.colors.onSurfaceVariant }]}>
          {formatDay(section.date)}
        </Text>
        {planned && <StatusBadge status="planned" />}
        {/* その日の支出の合計。右端はカードの中の金額とそろえる */}
        {expense > 0 && (
          <Text variant="labelLarge" style={[styles.dayTotal, { color: theme.colors.onSurfaceVariant }]}>
            支出 {formatYen(expense)}
          </Text>
        )}
      </View>
      {/* 今日より後の日付はまだ残高に入っていないので、塗らずに破線の枠で見せる */}
      <SectionCard dashed={planned}>
        {section.data.map((t) => (
          <TransactionRow key={t.id} transaction={t} {...context} />
        ))}
      </SectionCard>
    </View>
  );
}

type Props = RowContext & {
  /** 新しい日付順 */
  transactions: readonly Transaction[];
  /** これが変わったとき（月の切り替え・検索など）だけ、予定の下まで送る */
  viewKey: string;
  emptyText: string;
  refreshing: boolean;
  onRefresh: () => void;
};

/**
 * 日ごとのカードで記録を並べる。今日より後の予定は上にまとめ、開いたときは今日以前の記録が先頭に来るようにする
 * （予定しかないときはいちばん上から）
 */
export function TransactionDayList({ transactions, viewKey, emptyText, refreshing, onRefresh, ...context }: Props) {
  const theme = useTheme();
  const today = toTokyoDateString();
  const sections = groupByDate(transactions);
  const future = sections.filter((section) => section.date > today);
  const past = sections.filter((section) => section.date <= today);

  const listRef = useRef<FlatList<DaySection>>(null);
  // 引っぱって更新したときなどは動かさない
  const skippedFor = useRef<string | null>(null);
  const skipFuture = (futureHeight: number) => {
    if (skippedFor.current === viewKey || past.length === 0) return;
    skippedFor.current = viewKey;
    requestAnimationFrame(() =>
      listRef.current?.scrollToOffset({ offset: futureHeight + SPACING.screen, animated: false }),
    );
  };

  return (
    <FlatList
      ref={listRef}
      data={past}
      keyExtractor={(section) => section.date}
      renderItem={({ item }) => <DayCard section={item} {...context} />}
      ListHeaderComponent={
        future.length > 0 ? (
          <View style={styles.future} onLayout={(e) => skipFuture(e.nativeEvent.layout.height)}>
            {future.map((section) => (
              <DayCard key={section.date} section={section} planned {...context} />
            ))}
          </View>
        ) : null
      }
      ListEmptyComponent={
        future.length > 0 ? null : (
          <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]} variant="bodyMedium">
            {emptyText}
          </Text>
        )
      }
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
}

const styles = StyleSheet.create({
  subtitle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  subtitleText: { flexShrink: 1 },
  amount: { fontWeight: '700' },
  day: { gap: 6 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  future: { gap: 16, marginBottom: 16 },
  dayLabel: { paddingHorizontal: 4, fontWeight: '700' },
  dayTotal: { marginLeft: 'auto', paddingRight: SPACING.row, fontVariant: ['tabular-nums'] },
  empty: { padding: 32, textAlign: 'center' },
  listContent: { padding: SPACING.screen, gap: 16, paddingBottom: 96 },
});

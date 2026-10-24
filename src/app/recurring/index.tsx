import { router, Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Snackbar, Switch, Text, useTheme } from 'react-native-paper';

import { AddFab } from '@/components/AddFab';
import { Amount } from '@/components/Amount';
import { ListRow } from '@/components/ListRow';
import { QueriesState } from '@/components/QueryState';
import { SectionCard } from '@/components/SectionCard';
import { useAccounts } from '@/features/accounts/hooks';
import type { RecurringRule } from '@/features/recurring/api';
import { useRules, useSetRuleActive } from '@/features/recurring/hooks';
import { scheduleLabel } from '@/features/recurring/labels';
import { nextOccurrence } from '@/features/recurring/schedule';
import { amountKindOf, describeAccounts, TRANSACTION_RULES } from '@/features/transactions/transactionRules';
import { formatDay, toTokyoDateString } from '@/lib/date';
import { SPACING } from '@/theme';

function openRule(id: string) {
  router.push({ pathname: '/recurring/[id]', params: { id } });
}

export default function RecurringRulesScreen() {
  const theme = useTheme();
  const rules = useRules();
  const accounts = useAccounts();
  const setActive = useSetRuleActive();
  const today = toTokyoDateString();

  const describe = (rule: RecurringRule) => {
    const next = rule.is_active ? nextOccurrence(rule, today) : null;
    const where = describeAccounts(rule, accounts.data ?? []);
    return [scheduleLabel(rule), where, next ? `次回 ${formatDay(next)}` : null].filter(Boolean).join('・');
  };

  const renderRule = (rule: RecurringRule) => (
    <ListRow
      key={rule.id}
      title={rule.name}
      subtitle={describe(rule)}
      icon={TRANSACTION_RULES[rule.type].icon}
      iconColor={rule.is_active ? undefined : theme.colors.onSurfaceVariant}
      right={
        <View style={styles.right}>
          <Amount value={rule.amount} kind={amountKindOf(rule.type)} variant="bodyLarge" style={styles.amount} />
          {/* 止めているものは一覧からそのまま動かせる（2026-10-24 改善要望: 動かし方が分からない） */}
          {!rule.is_active && (
            <Switch
              value={false}
              disabled={setActive.isPending}
              onValueChange={() => setActive.mutate({ id: rule.id, isActive: true })}
              accessibilityLabel={`${rule.name}を動かす`}
            />
          )}
        </View>
      }
      onPress={() => openRule(rule.id)}
    />
  );

  const active = rules.data?.filter((r) => r.is_active) ?? [];
  const paused = rules.data?.filter((r) => !r.is_active) ?? [];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: '定期支払い' }} />
      {!rules.data || !accounts.data ? (
        <QueriesState queries={[rules, accounts]} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {rules.data.length === 0 && (
            <Text style={styles.empty} variant="bodyMedium">
              定期支払いがありません
            </Text>
          )}
          {active.length > 0 && <SectionCard>{active.map(renderRule)}</SectionCard>}
          {paused.length > 0 && <SectionCard title="止めている定期支払い">{paused.map(renderRule)}</SectionCard>}
        </ScrollView>
      )}
      <AddFab label="定期支払いを追加" onPress={() => openRule('new')} />
      <Snackbar visible={setActive.isError} onDismiss={setActive.reset}>
        変更できませんでした。通信状態を確認してください
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: SPACING.screen, paddingTop: 4, gap: SPACING.gap, paddingBottom: 96 },
  empty: { padding: 24, textAlign: 'center' },
  amount: { fontWeight: '700' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

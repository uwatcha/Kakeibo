import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Snackbar, Switch, Text, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { ListRow } from '@/components/ListRow';
import { RADIUS } from '@/theme';

import { ACCOUNT_KIND_INFO } from '../accountKinds';
import { useUpdateAccount } from '../hooks';
import type { AccountBalance } from '../summary';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  accounts: readonly AccountBalance[];
};

/** 汎用資産に含める口座をスイッチで選ぶ小さな画面。切り替えるとすぐ保存し、合計もすぐ変わる */
export function AvailableAccountsSheet({ visible, onDismiss, accounts }: Props) {
  const theme = useTheme();
  const update = useUpdateAccount();
  // 保存が終わって読み直すまでは、切り替えた後の状態で見せる
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const included = (a: AccountBalance) => pending[a.id] ?? a.includeInAvailable;
  const visibleAccounts = accounts.filter((a) => !a.isArchived);
  // 普段使わない口座は下にまとめて見分けられるようにする
  const groups = [
    { title: '普段使う口座', accounts: visibleAccounts.filter((a) => !a.isReserved) },
    { title: '普段使わない口座', accounts: visibleAccounts.filter((a) => a.isReserved) },
  ];
  const total = visibleAccounts.filter(included).reduce((sum, a) => sum + a.balance, 0);

  const toggle = (account: AccountBalance, value: boolean) => {
    setPending((p) => ({ ...p, [account.id]: value }));
    update.mutate(
      { id: account.id, values: { include_in_available: value } },
      {
        onSettled: () =>
          setPending((p) => {
            const next = { ...p };
            delete next[account.id];
            return next;
          }),
      },
    );
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.sheet, { backgroundColor: theme.colors.surface }]}
      >
        <Text variant="titleMedium" style={styles.title}>
          汎用資産に含める口座
        </Text>
        <Amount value={total} variant="headlineMedium" style={[styles.total, styles.title]} />
        <ScrollView style={styles.list}>
          {groups.map(
            (group) =>
              group.accounts.length > 0 && (
                <View key={group.title}>
                  <Text variant="labelLarge" style={[styles.group, { color: theme.colors.onSurfaceVariant }]}>
                    {group.title}
                  </Text>
                  {group.accounts.map((a) => (
                    <ListRow
                      key={a.id}
                      title={a.name}
                      subtitle={<Amount value={a.balance} variant="bodySmall" />}
                      icon={ACCOUNT_KIND_INFO[a.kind].icon}
                      iconColor={a.isReserved ? theme.colors.onSurfaceVariant : undefined}
                      right={<Switch value={included(a)} onValueChange={(v) => toggle(a, v)} />}
                      onPress={() => toggle(a, !included(a))}
                    />
                  ))}
                </View>
              ),
          )}
        </ScrollView>
        <Button onPress={onDismiss} style={styles.close}>
          閉じる
        </Button>
      </Modal>
      <Snackbar visible={update.isError} onDismiss={update.reset}>
        保存できませんでした
      </Snackbar>
    </Portal>
  );
}

const styles = StyleSheet.create({
  sheet: { margin: 16, paddingVertical: 20, borderRadius: RADIUS.card, maxHeight: '85%' },
  title: { paddingHorizontal: 20, fontWeight: '700' },
  total: { marginTop: 4, marginBottom: 8, fontWeight: '800' },
  list: { flexGrow: 0 },
  group: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 2, fontWeight: '700' },
  close: { alignSelf: 'flex-end', marginTop: 8, marginRight: 12 },
});

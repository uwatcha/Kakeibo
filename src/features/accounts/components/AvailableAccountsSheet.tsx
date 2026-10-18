import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, List, Modal, Portal, Snackbar, Switch, Text, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';

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
  const visibleAccounts = accounts.filter((a) => !a.isArchived).sort((a, b) => a.sortOrder - b.sortOrder);
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
        contentContainerStyle={[styles.sheet, { backgroundColor: theme.colors.elevation.level3 }]}
      >
        <Text variant="titleMedium">汎用資産に含める口座</Text>
        <Amount value={total} variant="headlineMedium" style={styles.total} />
        <ScrollView style={styles.list}>
          {visibleAccounts.map((a) => (
            <List.Item
              key={a.id}
              title={a.name}
              description={() => <Amount value={a.balance} variant="bodySmall" />}
              left={(props) => <List.Icon {...props} icon={ACCOUNT_KIND_INFO[a.kind].icon} />}
              right={() => (
                <View style={styles.switch}>
                  <Switch value={included(a)} onValueChange={(v) => toggle(a, v)} />
                </View>
              )}
              onPress={() => toggle(a, !included(a))}
            />
          ))}
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
  sheet: { margin: 16, padding: 16, borderRadius: 16, maxHeight: '85%' },
  total: { marginTop: 4, marginBottom: 8 },
  list: { flexGrow: 0 },
  switch: { justifyContent: 'center' },
  close: { alignSelf: 'flex-end', marginTop: 8 },
});

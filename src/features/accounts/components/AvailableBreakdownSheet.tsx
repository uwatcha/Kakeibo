import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Text, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { ListRow } from '@/components/ListRow';
import { formatDay } from '@/lib/date';
import { RADIUS, SPACING } from '@/theme';

import { ACCOUNT_KIND_INFO } from '../accountKinds';
import { availableBreakdown } from '../summary';
import type { AccountBalance } from '../summary';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  accounts: readonly AccountBalance[];
  /** 汎用資産に含めた予定（クレカの最後の引き落としの日まで）。なければ null */
  planned: { through: string; amount: number } | null;
};

/** 汎用資産の内訳。プラスの口座とマイナスの口座（クレカの未払い・借りているお金など）を分けて並べる */
export function AvailableBreakdownSheet({ visible, onDismiss, accounts, planned }: Props) {
  const theme = useTheme();
  const { plus, minus, plusTotal, minusTotal } = availableBreakdown(accounts);

  const group = (title: string, items: readonly AccountBalance[], total: number) =>
    items.length > 0 && (
      <View>
        <View style={styles.groupHeader}>
          <Text variant="labelLarge" style={[styles.bold, { color: theme.colors.onSurfaceVariant }]}>
            {title}
          </Text>
          <Amount value={total} kind="delta" variant="labelLarge" style={styles.bold} />
        </View>
        {items.map((a) => (
          <ListRow
            key={a.id}
            title={a.name}
            icon={ACCOUNT_KIND_INFO[a.kind].icon}
            right={<Amount value={a.balance} variant="bodyLarge" />}
          />
        ))}
      </View>
    );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.sheet, { backgroundColor: theme.colors.surface }]}
      >
        <Text variant="titleMedium" style={[styles.title, styles.bold]}>
          汎用資産の内訳
        </Text>
        <Amount
          value={plusTotal + minusTotal + (planned?.amount ?? 0)}
          variant="headlineMedium"
          style={[styles.title, styles.total]}
        />
        <ScrollView style={styles.list}>
          {group('プラス', plus, plusTotal)}
          {group('マイナス', minus, minusTotal)}
          {planned && (
            <View style={styles.groupHeader}>
              <Text variant="labelLarge" style={[styles.bold, { color: theme.colors.onSurfaceVariant }]}>
                予定（{formatDay(planned.through)}まで）
              </Text>
              <Amount value={planned.amount} kind="delta" variant="labelLarge" style={styles.bold} />
            </View>
          )}
        </ScrollView>
        <Button onPress={onDismiss} style={styles.close}>
          閉じる
        </Button>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  sheet: { margin: 16, paddingVertical: 20, borderRadius: RADIUS.card, maxHeight: '85%' },
  title: { paddingHorizontal: 20 },
  bold: { fontWeight: '700' },
  total: { fontWeight: '800', marginTop: 4, marginBottom: 8 },
  list: { flexGrow: 0 },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.row,
    paddingTop: 10,
    paddingBottom: 2,
  },
  close: { alignSelf: 'flex-end', marginTop: 8, marginRight: 12 },
});

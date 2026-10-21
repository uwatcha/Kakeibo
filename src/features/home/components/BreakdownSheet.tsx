import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Text, useTheme } from 'react-native-paper';

import { Amount, type AmountKind } from '@/components/Amount';
import { ListRow } from '@/components/ListRow';
import { RADIUS, SPACING } from '@/theme';

export type BreakdownRow = {
  key: string;
  icon: string;
  title: string;
  subtitle?: string;
  amount: number;
  /** 口座の残高は balance、予定の増減は delta */
  kind: AmountKind;
};

export type BreakdownSection = { title: string; total: number; rows: BreakdownRow[] };

type Props = {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  total: number;
  sections: BreakdownSection[];
  /** 合計の下に出す補足（1日あたりの額など） */
  note?: string;
};

/** ホームのカードの内訳。口座の残高や予定の増減を、まとまりごとに合計と一緒に並べる */
export function BreakdownSheet({ visible, onDismiss, title, total, sections, note }: Props) {
  const theme = useTheme();
  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.sheet, { backgroundColor: theme.colors.surface }]}
      >
        <Text variant="titleMedium" style={[styles.padded, styles.bold]}>
          {title}の内訳
        </Text>
        <Amount value={total} variant="headlineMedium" style={[styles.padded, styles.total]} />
        {note && (
          <Text variant="bodyMedium" style={[styles.padded, { color: theme.colors.onSurfaceVariant }]}>
            {note}
          </Text>
        )}
        <ScrollView style={styles.list}>
          {sections
            .filter((section) => section.rows.length > 0)
            .map((section) => (
              <View key={section.title}>
                <View style={styles.groupHeader}>
                  <Text variant="labelLarge" style={[styles.bold, { color: theme.colors.onSurfaceVariant }]}>
                    {section.title}
                  </Text>
                  <Amount value={section.total} kind="delta" variant="labelLarge" style={styles.bold} />
                </View>
                {section.rows.map((row) => (
                  <ListRow
                    key={row.key}
                    title={row.title}
                    subtitle={row.subtitle}
                    icon={row.icon}
                    wrap
                    right={<Amount value={row.amount} kind={row.kind} variant="bodyLarge" />}
                  />
                ))}
              </View>
            ))}
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
  padded: { paddingHorizontal: 20 },
  bold: { fontWeight: '700' },
  total: { fontWeight: '800', marginTop: 4 },
  list: { flexGrow: 0, marginTop: 4 },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.row,
    paddingTop: 10,
    paddingBottom: 2,
  },
  close: { alignSelf: 'flex-end', marginTop: 8, marginRight: 12 },
});

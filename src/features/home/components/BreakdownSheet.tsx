import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Text, useTheme } from 'react-native-paper';

import { Amount, type AmountKind } from '@/components/Amount';
import { ListRow } from '@/components/ListRow';
import { formatYen } from '@/lib/money';
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

/** 式の1項。最初の項は op なし。unit が day なら日数（それ以外は円） */
export type FormulaTerm = { op?: '＋' | '−' | '×'; label: string; value: number; unit?: 'day' };
/** 計算式（2026-10-28 ユーザーの要望: タップしたら式と各項の値を出す）。result ＝ 項 … */
export type Formula = { result: string; terms: FormulaTerm[]; note?: string };

type Props = {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  total: number;
  sections: BreakdownSection[];
  /** 合計の下に出す補足（1日あたりの額など） */
  note?: string;
  /** 計算式（上から順に。2つ目以降は1つ目の項の中身） */
  formulas?: Formula[];
};

const termValue = (t: FormulaTerm) => (t.unit === 'day' ? `${t.value}日` : formatYen(t.value));

/**
 * 式を1行の文にする（ホームのカードの金額の下に出す。2026-11-02 改善要望: 押さなくても計算方法が分かるように）。
 * 項が多い（所持金の口座など）ときは maxTerms までにして、残りは「ほか n 件」にまとめる
 */
export function formulaText(formula: Formula, maxTerms = 3): string {
  const shown = formula.terms.slice(0, maxTerms);
  const rest = formula.terms.length - shown.length;
  const text = shown.map((t) => `${t.op ? `${t.op} ` : ''}${t.label} ${termValue(t)}`).join(' ');
  return rest > 0 ? `${text} ＋ ほか${rest}件` : text;
}

/** 計算式: 1行目に「結果 ＝ 項 ＋ 項」、その下に各項の値 */
function FormulaBlock({ formula }: { formula: Formula }) {
  const theme = useTheme();
  const muted = { color: theme.colors.onSurfaceVariant };
  return (
    <View style={[styles.formula, { backgroundColor: theme.colors.surfaceVariant }]}>
      <Text variant="bodyMedium" style={styles.bold}>
        {formula.result} ＝ {formula.terms.map((t) => `${t.op ? `${t.op} ` : ''}${t.label}`).join(' ')}
      </Text>
      {formula.terms.map((t) => (
        <View key={`${t.op ?? ''}${t.label}`} style={styles.term}>
          <Text variant="bodyMedium" style={[styles.op, muted]}>
            {t.op ?? ''}
          </Text>
          <Text variant="bodyMedium" style={[styles.termLabel, muted]}>
            {t.label}
          </Text>
          <Text variant="bodyMedium" style={styles.bold}>
            {termValue(t)}
          </Text>
        </View>
      ))}
      {formula.note && (
        <Text variant="bodySmall" style={muted}>
          {formula.note}
        </Text>
      )}
    </View>
  );
}

/** ホームのカードの内訳。口座の残高や予定の増減を、まとまりごとに合計と一緒に並べる */
export function BreakdownSheet({ visible, onDismiss, title, total, sections, note, formulas }: Props) {
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
          {formulas?.map((f) => <FormulaBlock key={f.result} formula={f} />)}
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
  formula: { marginHorizontal: SPACING.row, marginTop: 8, padding: 12, borderRadius: RADIUS.tile, gap: 2 },
  term: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  op: { width: 14, textAlign: 'center' },
  termLabel: { flex: 1 },
});

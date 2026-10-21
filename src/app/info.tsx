import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { SectionCard } from '@/components/SectionCard';
import { ACCOUNT_KIND_INFO, type AccountKind } from '@/features/accounts/accountKinds';
import { ACCOUNT_DESCRIPTIONS, BALANCE_TERMS, OTHER_TERMS, type Term, TYPE_DESCRIPTIONS } from '@/features/info/terms';
import { TRANSACTION_RULES, type TransactionType } from '@/features/transactions/transactionRules';
import { SPACING } from '@/theme';

function TermItem({ term, description }: Term) {
  const theme = useTheme();
  return (
    <View style={styles.term}>
      <Text variant="titleSmall" style={styles.termTitle}>
        {term}
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {description}
      </Text>
    </View>
  );
}

export default function InfoScreen() {
  const theme = useTheme();

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
      <SectionCard title="残高">
        {BALANCE_TERMS.map((t) => (
          <TermItem key={t.term} {...t} />
        ))}
      </SectionCard>
      <SectionCard title="口座の種類">
        {(Object.keys(ACCOUNT_DESCRIPTIONS) as AccountKind[]).map((kind) => (
          <TermItem key={kind} term={ACCOUNT_KIND_INFO[kind].label} description={ACCOUNT_DESCRIPTIONS[kind]} />
        ))}
      </SectionCard>
      <SectionCard title="記録の種類">
        {(Object.keys(TYPE_DESCRIPTIONS) as TransactionType[]).map((type) => (
          <TermItem key={type} term={TRANSACTION_RULES[type].label} description={TYPE_DESCRIPTIONS[type]} />
        ))}
      </SectionCard>
      <SectionCard title="そのほか">
        {OTHER_TERMS.map((t) => (
          <TermItem key={t.term} {...t} />
        ))}
      </SectionCard>
      <Text variant="bodySmall" style={[styles.footer, { color: theme.colors.onSurfaceVariant }]}>
        金額はすべて円単位、日付は日本時間です。
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.screen, paddingTop: 4, gap: SPACING.gap, paddingBottom: 32 },
  term: { paddingHorizontal: SPACING.row, paddingVertical: 8, gap: 2 },
  termTitle: { fontWeight: '700' },
  footer: { paddingHorizontal: 4 },
});

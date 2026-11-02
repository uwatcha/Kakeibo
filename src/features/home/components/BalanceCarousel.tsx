import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { Carousel } from '@/components/Carousel';
import { SectionCard } from '@/components/SectionCard';

import { type Formula, termValue } from './BreakdownSheet';

type Page = {
  title: string;
  amount: number;
  detail?: string;
  /** 計算方法。金額の下に小さく出す（式なら項の名前と値の2段、文なら「＝」を付けずにそのまま） */
  formula?: Formula | string;
  /** カード右上の小さなボタン */
  action?: { icon: string; label: string; onPress: () => void };
  /**
   * 言い換える前の見出し（使える額がマイナスで「足りない額」に言い換えたときなど）。
   * 元の項目が別のものに変わったことが分かるよう、見出しの上に小さく薄い取り消し線で残す
   */
  replacedTitle?: string;
  /** negative なら金額を赤で出す（足りない額を正の数で出すとき） */
  tone?: 'negative';
  /** カードを押したとき（内訳を開く）。あれば右上に「内訳 ›」を出す */
  onPress?: () => void;
};

/**
 * カードの計算方法（2026-11-02 ユーザーの指定）: 上の段に項の名前、下の段に値を、
 * 「＝ 名前 ＋ 名前」「＝ 値 ＋ 値」のように、記号の位置をそろえて列で並べる
 */
function FormulaRows({ formula }: { formula: Formula }) {
  const theme = useTheme();
  const muted = { color: theme.colors.onSurfaceVariant };
  const symbol = (text: string, key: string) => (
    <View key={key} style={styles.symbol}>
      <Text variant="bodySmall" style={muted}>
        {text}
      </Text>
      <Text variant="bodySmall" style={muted}>
        {text}
      </Text>
    </View>
  );
  return (
    <View style={styles.formula}>
      {symbol('＝', 'eq')}
      {formula.terms.flatMap((t, i) => [
        ...(t.op ? [symbol(t.op, `op${i}`)] : []),
        <View key={`term${i}`} style={styles.term}>
          <Text variant="bodySmall" style={muted} numberOfLines={2}>
            {t.label}
          </Text>
          <Text variant="bodySmall" style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
            {termValue(t)}
          </Text>
        </View>,
      ])}
    </View>
  );
}

/** ホーム上部の金額カード。横にスワイプして切り替える */
export function BalanceCarousel({ pages }: { pages: Page[] }) {
  const theme = useTheme();
  return (
    <Carousel
      pages={pages.map((page) => ({
        key: page.title,
        label: page.title,
        content: (
          <Pressable
            onPress={page.onPress}
            disabled={!page.onPress}
            accessibilityRole={page.onPress ? 'button' : undefined}
            accessibilityLabel={page.onPress ? `${page.title}の内訳` : undefined}
          >
            <SectionCard style={styles.card}>
              {page.replacedTitle && (
                <Text variant="labelSmall" style={[styles.replaced, { color: theme.colors.onSurfaceVariant }]}>
                  {page.replacedTitle}
                </Text>
              )}
              <View style={styles.header}>
                <Text variant="titleMedium" style={styles.title}>
                  {page.title}
                </Text>
                {/* 押すと内訳が出ることが分かるように */}
                {page.onPress && !page.action && (
                  <View style={styles.more}>
                    <Text variant="labelMedium" style={{ color: theme.colors.primary }}>
                      内訳
                    </Text>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.primary} />
                  </View>
                )}
                {page.action && (
                  <IconButton
                    icon={page.action.icon}
                    size={20}
                    iconColor={theme.colors.primary}
                    accessibilityLabel={page.action.label}
                    onPress={page.action.onPress}
                    style={styles.action}
                  />
                )}
              </View>
              <Amount
                value={page.amount}
                variant="displaySmall"
                style={[styles.amount, page.tone === 'negative' && { color: theme.colors.error }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              />
              {typeof page.formula === 'string' ? (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {page.formula}
                </Text>
              ) : (
                page.formula && <FormulaRows formula={page.formula} />
              )}
              {page.detail && (
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {page.detail}
                </Text>
              )}
            </SectionCard>
          </Pressable>
        ),
      }))}
    />
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 20, paddingVertical: 16, minHeight: 132 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 },
  title: { fontWeight: '700' },
  amount: { fontWeight: '800', marginTop: 4 },
  replaced: { textDecorationLine: 'line-through', opacity: 0.7 },
  action: { margin: -8 },
  more: { flexDirection: 'row', alignItems: 'center' },
  formula: { flexDirection: 'row', alignItems: 'stretch', gap: 6, marginTop: 2 },
  // 名前が2行になっても、記号と値の段がそろうよう上下に分ける
  symbol: { justifyContent: 'space-between' },
  term: { flexShrink: 1, justifyContent: 'space-between' },
  value: { fontWeight: '700' },
});

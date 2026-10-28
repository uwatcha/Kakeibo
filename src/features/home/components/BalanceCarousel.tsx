import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { Carousel } from '@/components/Carousel';
import { SectionCard } from '@/components/SectionCard';

type Page = {
  title: string;
  amount: number;
  detail?: string;
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
});

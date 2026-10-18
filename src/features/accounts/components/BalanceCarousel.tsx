import { StyleSheet, View } from 'react-native';
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
          <SectionCard style={styles.card}>
            <View style={styles.header}>
              <Text variant="titleMedium" style={styles.title}>
                {page.title}
              </Text>
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
              style={styles.amount}
              numberOfLines={1}
              adjustsFontSizeToFit
            />
            {page.detail && (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {page.detail}
              </Text>
            )}
          </SectionCard>
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
  action: { margin: -8 },
});

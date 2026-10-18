import { StyleSheet, View } from 'react-native';
import { Card, IconButton, Text, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { Carousel } from '@/components/Carousel';

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
          <Card>
            <Card.Content>
              <View style={styles.header}>
                <Text variant="labelLarge">{page.title}</Text>
                {page.action && (
                  <IconButton
                    icon={page.action.icon}
                    size={18}
                    accessibilityLabel={page.action.label}
                    onPress={page.action.onPress}
                    style={styles.action}
                  />
                )}
              </View>
              <Amount value={page.amount} variant="displaySmall" numberOfLines={1} adjustsFontSizeToFit />
              {page.detail && (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {page.detail}
                </Text>
              )}
            </Card.Content>
          </Card>
        ),
      }))}
    />
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 },
  action: { margin: -8 },
});

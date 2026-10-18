import { StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { Carousel } from '@/components/Carousel';
import { formatYen } from '@/lib/money';

type Page = { title: string; amount: number };

/** ホーム上部の金額カード。横にスワイプして切り替える */
export function BalanceCarousel({ pages }: { pages: Page[] }) {
  return (
    <Carousel
      pages={pages.map((page) => ({
        key: page.title,
        label: page.title,
        content: (
          <Card>
            <Card.Content>
              <Text variant="labelLarge">{page.title}</Text>
              <Text variant="displaySmall" style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
                {formatYen(page.amount)}
              </Text>
            </Card.Content>
          </Card>
        ),
      }))}
    />
  );
}

const styles = StyleSheet.create({
  amount: { fontVariant: ['tabular-nums'] },
});

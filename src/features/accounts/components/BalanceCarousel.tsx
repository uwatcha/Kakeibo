import { Card, Text } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { Carousel } from '@/components/Carousel';

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
              <Amount value={page.amount} variant="displaySmall" numberOfLines={1} adjustsFontSizeToFit />
            </Card.Content>
          </Card>
        ),
      }))}
    />
  );
}

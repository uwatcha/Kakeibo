import { Card, Text, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { Carousel } from '@/components/Carousel';

type Page = { title: string; amount: number; detail?: string };

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
              <Text variant="labelLarge">{page.title}</Text>
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

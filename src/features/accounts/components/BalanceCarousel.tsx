import { useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';

import { formatYen } from '@/lib/money';

type Page = { title: string; caption: string; amount: number };

/** ホーム上部の金額カード。横にスワイプして切り替える */
export function BalanceCarousel({ pages }: { pages: Page[] }) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
    setIndex(i);
  };

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
      >
        {pages.map((page) => (
          <View key={page.title} style={{ width }}>
            <Card>
              <Card.Content>
                <Text variant="labelLarge">{page.title}</Text>
                <Text variant="displaySmall" style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
                  {formatYen(page.amount)}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {page.caption}
                </Text>
              </Card.Content>
            </Card>
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {pages.map((page, i) => (
          <Pressable
            key={page.title}
            onPress={() => goTo(i)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${page.title}を表示`}
            accessibilityState={{ selected: i === index }}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: i === index ? theme.colors.primary : theme.colors.outlineVariant },
              ]}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  amount: { fontVariant: ['tabular-nums'] },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

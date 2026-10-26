import { type ReactNode, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';

export type CarouselPage = {
  key: string;
  /** 下の点の読み上げに使う */
  label: string;
  content: ReactNode;
};

/** Web 版（PC）では、スワイプの代わりに点の左右の矢印でも切り替える */
const IS_WEB = Platform.OS === 'web';

/** 横にスワイプして1ページずつ切り替える。下の点でも切り替えられる */
export function Carousel({ pages }: { pages: CarouselPage[] }) {
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
        // Web は慣性スクロールの終わりの知らせがないので、動かしている間に点を合わせる
        onScroll={IS_WEB ? onScrollEnd : undefined}
        scrollEventThrottle={IS_WEB ? 100 : undefined}
      >
        {pages.map((page) => (
          <View key={page.key} style={{ width }}>
            {page.content}
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {IS_WEB && (
          <IconButton
            icon="chevron-left"
            size={18}
            style={styles.arrow}
            disabled={index === 0}
            onPress={() => goTo(index - 1)}
            accessibilityLabel="前へ"
          />
        )}
        {pages.map((page, i) => (
          <Pressable
            key={page.key}
            onPress={() => goTo(i)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${page.label}を表示`}
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
        {IS_WEB && (
          <IconButton
            icon="chevron-right"
            size={18}
            style={styles.arrow}
            disabled={index === pages.length - 1}
            onPress={() => goTo(index + 1)}
            accessibilityLabel="次へ"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingTop: 10 },
  arrow: { margin: -6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

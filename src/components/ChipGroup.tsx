import { type ReactNode, useEffect, useRef } from 'react';
import { type LayoutRectangle, ScrollView, StyleSheet, View } from 'react-native';
import { Chip } from 'react-native-paper';

export type ChipOption = { value: string; label: string; icon?: string };

type Props = {
  options: readonly ChipOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** true なら選択中のチップをもう一度押すと選択を外す */
  allowDeselect?: boolean;
  /** 列の最後に足すチップ（「すべて表示」など） */
  extra?: ReactNode;
  /** 2 なら2行に分けて並べ、横スクロールは2行まとめて動く（少ないときは1行） */
  rows?: 1 | 2;
};

/** 2行にするのは、チップがこの数より多いとき */
const MIN_FOR_TWO_ROWS = 4;
/** 選んだチップまでスクロールするとき、左に残す余白 */
const SCROLL_MARGIN = 24;

/**
 * 横スクロールで1つ選ぶチップの列。口座・カテゴリ・種類の選択に使う。
 * 選んでいるチップはアイコンがチェックマークになり、画面の外にあればそこまでスクロールする
 */
export function ChipGroup({ options, value, onChange, allowDeselect = false, extra, rows = 1 }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const chipLayouts = useRef(new Map<string, LayoutRectangle>());
  const viewport = useRef({ offset: 0, width: 0 });
  // 同じ選択で何度もスクロールしない（自分で横に動かしたあとに引き戻さない）
  const scrolledFor = useRef<string | null>(null);

  const scrollToSelected = (selected: string | null) => {
    if (!selected || scrolledFor.current === selected) return;
    const chip = chipLayouts.current.get(selected);
    const { offset, width } = viewport.current;
    if (!chip || width === 0) return;
    scrolledFor.current = selected;
    const visible = chip.x >= offset && chip.x + chip.width <= offset + width;
    if (!visible) scrollRef.current?.scrollTo({ x: Math.max(0, chip.x - SCROLL_MARGIN), animated: true });
  };

  useEffect(() => {
    // scrollToSelected は ref だけを読むので、value が変わったときだけでよい
    scrollToSelected(value);
  }, [value]);

  const chip = (o: ChipOption) => {
    const selected = o.value === value;
    return (
      <Chip
        key={o.value}
        icon={selected ? 'check' : o.icon}
        selected={selected}
        showSelectedOverlay
        onPress={() => onChange(selected && allowDeselect ? null : o.value)}
        onLayout={(e) => {
          chipLayouts.current.set(o.value, e.nativeEvent.layout);
          // 最初に選ばれていたチップは、並んだ時点でスクロールする
          if (selected) scrollToSelected(o.value);
        }}
      >
        {o.label}
      </Chip>
    );
  };

  const twoRows = rows === 2 && options.length > MIN_FOR_TWO_ROWS;
  // 前半を上の行、後半を下の行に置き、1つの横スクロールに入れて一緒に動かす
  const half = Math.ceil(options.length / 2);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={twoRows ? styles.grid : styles.row}
      scrollEventThrottle={64}
      onScroll={(e) => {
        viewport.current.offset = e.nativeEvent.contentOffset.x;
      }}
      onLayout={(e) => {
        viewport.current.width = e.nativeEvent.layout.width;
        scrollToSelected(value);
      }}
    >
      {twoRows ? (
        <>
          <View style={styles.row}>{options.slice(0, half).map(chip)}</View>
          <View style={styles.row}>
            {options.slice(half).map(chip)}
            {extra}
          </View>
        </>
      ) : (
        <>
          {options.map(chip)}
          {extra}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  grid: { flexDirection: 'column' },
});

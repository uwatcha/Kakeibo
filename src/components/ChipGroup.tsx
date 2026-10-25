import { type ReactNode, useEffect, useRef } from 'react';
import { Keyboard, type LayoutRectangle, ScrollView, StyleSheet, View } from 'react-native';
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
  /** 2 なら上下2つずつの列にして並べ（上→下→次の列の順）、横スクロールは2行まとめて動く（少ないときは1行） */
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
  // 2行のときチップの位置は列の中での位置なので、列の左端を足して横スクロールの中での位置にする
  const columnX = useRef(new Map<string, number>());
  const viewport = useRef({ offset: 0, width: 0 });
  // 同じ選択で何度もスクロールしない（自分で横に動かしたあとに引き戻さない）
  const scrolledFor = useRef<string | null>(null);

  const twoRows = rows === 2 && options.length > MIN_FOR_TWO_ROWS;
  // 列に入っているチップ（列の位置が分かるまでスクロールを待つ）
  const inColumn = useRef(new Set<string>());

  const scrollToSelected = (selected: string | null) => {
    if (!selected || scrolledFor.current === selected) return;
    const chip = chipLayouts.current.get(selected);
    // 2行のときは列の位置が分かるまで待つ
    if (inColumn.current.has(selected) && !columnX.current.has(selected)) return;
    const { offset, width } = viewport.current;
    if (!chip || width === 0) return;
    const x = chip.x + (columnX.current.get(selected) ?? 0);
    scrolledFor.current = selected;
    const visible = x >= offset && x + chip.width <= offset + width;
    if (!visible) scrollRef.current?.scrollTo({ x: Math.max(0, x - SCROLL_MARGIN), animated: true });
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
        onPress={() => {
          // キーボードを閉じて、同じタップで選ぶ（金額を入れたあとに口座などを押したとき）
          Keyboard.dismiss();
          onChange(selected && allowDeselect ? null : o.value);
        }}
        onLayout={(e) => {
          chipLayouts.current.set(o.value, e.nativeEvent.layout);
          if (twoRows) inColumn.current.add(o.value);
          else {
            inColumn.current.delete(o.value);
            columnX.current.delete(o.value);
          }
          // 最初に選ばれていたチップは、並んだ時点でスクロールする
          if (selected) scrollToSelected(o.value);
        }}
      >
        {o.label}
      </Chip>
    );
  };

  // 2つずつ縦に積んだ列を横に並べる。管理画面と同じ順のまま、先頭の項目が左に集まる
  const columns: ChipOption[][] = [];
  for (let i = 0; i < options.length; i += 2) columns.push(options.slice(i, i + 2));

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      // キーボードが出ていても、最初のタップでチップを押せるようにする（閉じるのは onPress で）
      keyboardShouldPersistTaps="handled"
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
          {columns.map((column) => (
            <View
              key={column[0].value}
              style={styles.column}
              onLayout={(e) => {
                for (const o of column) columnX.current.set(o.value, e.nativeEvent.layout.x);
                if (column.some((o) => o.value === value)) scrollToSelected(value);
              }}
            >
              {column.map(chip)}
            </View>
          ))}
          {extra && <View style={styles.column}>{extra}</View>}
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
  grid: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  column: { gap: 8, alignItems: 'flex-start' },
});

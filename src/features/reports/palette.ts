// 大分類別グラフの色。dataviz の検証済みカテゴリ配色（隣り合う色どうしが色覚の違いでも見分けられる順）の先頭5色
// 色は順位に付くため、月が変わると同じカテゴリでも色が変わる。カテゴリ名は凡例と一覧に必ず出す
export const SLICE_COLORS = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'],
} as const;

/** 「その他」はカテゴリではないので無彩色 */
export const OTHER_COLOR = { light: '#a3a29c', dark: '#6b6a64' } as const;

export function sliceColor(index: number, isOther: boolean, dark: boolean): string {
  const mode = dark ? 'dark' : 'light';
  return isOther ? OTHER_COLOR[mode] : SLICE_COLORS[mode][index % SLICE_COLORS[mode].length];
}

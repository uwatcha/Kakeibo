import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

// 見た目の決まりは DESIGN.md にまとめている。色や角丸を変えるときはそちらも直す

/** 角丸の大きさ。カードは CARD、行の中のアイコンの丸などは小さめ */
export const RADIUS = { card: 20, tile: 16, icon: 12 } as const;

/** 画面の左右の余白とカードどうしの間隔 */
export const SPACING = { screen: 16, gap: 12, row: 16 } as const;

const light: MD3Theme = {
  ...MD3LightTheme,
  // Paper の部品の角丸の基準（入力欄 5、ボタンは丸、カード 15）
  roundness: 5,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#24466f',
    onPrimary: '#ffffff',
    primaryContainer: '#dce6f3',
    onPrimaryContainer: '#0e2643',
    secondary: '#56657a',
    secondaryContainer: '#e3e9f1',
    onSecondaryContainer: '#1b2a3d',
    background: '#eef2f6',
    onBackground: '#1a1f26',
    surface: '#ffffff',
    onSurface: '#1a1f26',
    surfaceVariant: '#e6ebf1',
    onSurfaceVariant: '#5b6573',
    outline: '#a9b3c0',
    outlineVariant: '#dde3ea',
    error: '#c0453d',
    errorContainer: '#fbe4e1',
    onErrorContainer: '#5c1410',
    // カード・タブバー・ダイアログはどれも白にそろえ、段差は影でつける
    elevation: {
      level0: 'transparent',
      level1: '#ffffff',
      level2: '#ffffff',
      level3: '#ffffff',
      level4: '#ffffff',
      level5: '#ffffff',
    },
  },
};

const dark: MD3Theme = {
  ...MD3DarkTheme,
  roundness: 5,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#a9c4e8',
    onPrimary: '#0e2643',
    primaryContainer: '#2b4466',
    onPrimaryContainer: '#dce6f3',
    secondary: '#b8c4d4',
    secondaryContainer: '#2c3644',
    onSecondaryContainer: '#dce4ee',
    background: '#0f141a',
    onBackground: '#e3e8ee',
    surface: '#19202a',
    onSurface: '#e3e8ee',
    surfaceVariant: '#252e3a',
    onSurfaceVariant: '#a3adba',
    outline: '#5d6878',
    outlineVariant: '#2e3845',
    error: '#f08a80',
    errorContainer: '#5c1f1a',
    onErrorContainer: '#fbe4e1',
    elevation: {
      level0: 'transparent',
      level1: '#19202a',
      level2: '#1c2430',
      level3: '#202935',
      level4: '#222c38',
      level5: '#25303d',
    },
  },
};

export const themes = { light, dark };

/** 金額のプラス（収入・増加）の色。マイナスは theme.colors.error */
export function positiveColor(isDark: boolean): string {
  return isDark ? '#74c69a' : '#2e7d4f';
}

/** 収入の丸アイコンの背景 */
export function positiveContainer(isDark: boolean): string {
  return isDark ? '#1f3a2b' : '#e1f1e7';
}

/** 「未確認」など、見落としてほしくない印の色（赤ほど強くない橙） */
export function warningColors(isDark: boolean): { background: string; color: string } {
  return isDark ? { background: '#4d3300', color: '#ffd08a' } : { background: '#ffe2b8', color: '#7a4300' };
}

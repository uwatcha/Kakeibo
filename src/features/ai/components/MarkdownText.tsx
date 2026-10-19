import { StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from 'react-native-paper';

import { RADIUS } from '@/theme';

/** AI の返事を Markdown（見出し・太字・箇条書き・表・コード）として表示する。色と大きさはアプリのテーマに合わせる */
export function MarkdownText({ children }: { children: string }) {
  const theme = useTheme();
  const text = { color: theme.colors.onSurface, fontSize: 14, lineHeight: 21 };
  const style = StyleSheet.create({
    body: text,
    paragraph: { marginTop: 0, marginBottom: 8 },
    heading1: { ...text, fontSize: 18, lineHeight: 26, fontWeight: '700', marginBottom: 6 },
    heading2: { ...text, fontSize: 16, lineHeight: 24, fontWeight: '700', marginBottom: 6 },
    heading3: { ...text, fontSize: 15, lineHeight: 22, fontWeight: '700', marginBottom: 4 },
    strong: { fontWeight: '700' },
    bullet_list: { marginBottom: 8 },
    ordered_list: { marginBottom: 8 },
    list_item: { marginBottom: 2 },
    code_inline: {
      backgroundColor: theme.colors.surfaceVariant,
      color: theme.colors.onSurface,
      borderRadius: 4,
      paddingHorizontal: 4,
    },
    fence: {
      backgroundColor: theme.colors.surfaceVariant,
      color: theme.colors.onSurface,
      borderRadius: RADIUS.icon,
      borderWidth: 0,
      padding: 10,
    },
    code_block: { backgroundColor: theme.colors.surfaceVariant, borderRadius: RADIUS.icon, borderWidth: 0 },
    blockquote: {
      backgroundColor: theme.colors.surfaceVariant,
      borderLeftColor: theme.colors.outline,
      borderLeftWidth: 3,
      paddingHorizontal: 8,
    },
    table: { borderColor: theme.colors.outlineVariant, borderRadius: 8, marginBottom: 8 },
    th: { padding: 6, fontWeight: '700' },
    td: { padding: 6 },
    tr: { borderColor: theme.colors.outlineVariant },
    hr: { backgroundColor: theme.colors.outlineVariant, marginVertical: 8 },
    link: { color: theme.colors.primary },
  });
  return <Markdown style={style}>{children}</Markdown>;
}

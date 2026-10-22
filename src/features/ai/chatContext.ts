import type { HomeFigures } from '@/features/home/figures';
import { appGuideText } from '@/features/info/terms';

import { type Aliases, type AiSource, buildContext, SYSTEM_PROMPT } from './anonymize';
import { homeContext } from './homeContext';

/** AI 相談の指示: 相談の決まり・アプリの画面と用語・家計の材料・ホームに出ている額（名前は置き換え済み） */
export function buildChatSystem(source: AiSource, aliases: Aliases, home: HomeFigures | null): string {
  return [
    SYSTEM_PROMPT,
    `# アプリの画面と用語\n${appGuideText()}`,
    `# 家計の材料\n${buildContext(source, aliases)}`,
    ...(home ? [homeContext(home, aliases)] : []),
  ].join('\n\n');
}

import type { ReactElement } from 'react';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestInstance } from 'react-test-renderer';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

/**
 * 画面を描いて、実機でアプリが落ちる「Text の外の文字」を探す（テストの描画では落ちないので自分で調べる）。
 * 見つかった文字と、その親の部品の名前を返す
 */
export async function renderAndCheck(element: ReactElement): Promise<string[]> {
  let tree: ReturnType<typeof create> | undefined;
  await act(async () => {
    tree = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <PaperProvider>{element}</PaperProvider>
      </SafeAreaProvider>,
    );
  });
  const problems: string[] = [];
  const walk = (node: ReactTestInstance, insideText: boolean, path: string[]) => {
    const name =
      typeof node.type === 'string'
        ? node.type
        : ((node.type as { displayName?: string; name?: string }).displayName ??
          (node.type as { name?: string }).name ??
          '?');
    const isText = name === 'Text' || name === 'RCTText' || name === 'RCTVirtualText';
    for (const child of node.children) {
      if (typeof child === 'string') {
        if (!insideText && !isText && child.trim() !== '')
          problems.push(`"${child}" in ${[...path, name].slice(-4).join(' > ')}`);
      } else {
        walk(child, insideText || isText, [...path, name]);
      }
    }
  };
  walk(tree!.root, false, []);
  return problems;
}

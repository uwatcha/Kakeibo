// ウィジェットはライブラリが React の外で組み立てる（buildWidgetTree）。React Compiler の変換が入ると
// useMemoCache が null で落ちるので、テストも同じ組み立て方で確かめる（jest も React Compiler を通す）
// @ts-expect-error 公開していない部品なので型の宣言がない（中身は lib/typescript/api/build-widget-tree.d.ts）
import { buildWidgetTree } from 'react-native-android-widget/lib/module/api/build-widget-tree';

import { QuickAddWidget, QuickPhotoWidget } from './QuickWidgets';

describe('ホーム画面のウィジェット', () => {
  it.each([
    ['記録', QuickAddWidget, 'kakeibo-quick://add'],
    ['写真', QuickPhotoWidget, 'kakeibo-quick://photo'],
  ])('%s のウィジェットを組み立てられる', (_label, Widget, uri) => {
    const tree = JSON.stringify(buildWidgetTree(<Widget />));
    expect(tree).toContain(uri);
    expect(tree).toContain('<svg');
  });
});

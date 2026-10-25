import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { WIDGETS } from './taskHandler';

/**
 * ホーム画面に置いてあるウィジェットを描き直す（アプリを開いたときに1回）。
 * このライブラリのウィジェットは置いたとき・大きさを変えたときにしか描かれないので、描く処理を直して配信しても、
 * 前に描けなかったウィジェットは描かれないまま残り、押すとふつうにアプリが開いてしまう（2026-10-25）。
 * 開くたびに描き直して、配信のあとでも直るようにする
 */
export async function refreshWidgets(): Promise<void> {
  if (Platform.OS !== 'android') return;
  for (const [widgetName, Widget] of Object.entries(WIDGETS)) {
    try {
      await requestWidgetUpdate({ widgetName, renderWidget: () => <Widget /> });
    } catch {
      // 置いていない・描けないときは何もしない
    }
  }
}

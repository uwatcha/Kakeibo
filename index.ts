// アプリの入口。Expo Router のアプリ本体（'main'）に加えて、ホーム画面のウィジェットから開く入力用の画面
// （'quickadd'。QuickAddActivity が出す）と、ウィジェットを描く処理を登録する
import 'expo-router/entry';

import { AppRegistry, Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { QuickAddRoot } from './src/features/quick/QuickAddRoot';
import { widgetTaskHandler } from './src/widgets/taskHandler';

// ウィジェットは Android だけ（Web 版では登録しない）
if (Platform.OS === 'android') {
  AppRegistry.registerComponent('quickadd', () => QuickAddRoot);
  registerWidgetTaskHandler(widgetTaskHandler);
}

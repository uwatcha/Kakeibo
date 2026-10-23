// ホーム画面のウィジェットから開く、背景が透けた入力用の画面（QuickAddActivity）を足す設定（Expo の config plugin）。
// アプリ本体（MainActivity）とは別の入口で、JS の 'quickadd'（index.ts で登録）を出す。
// kakeibo-quick://add（手入力のシート）・kakeibo-quick://photo（写真）で開く
const { AndroidConfig, withAndroidManifest, withAndroidStyles, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const THEME = 'Theme.App.QuickAdd';

function activitySource(packageName) {
  return `package ${packageName}

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import expo.modules.ReactActivityDelegateWrapper

/** ウィジェットから開く、背景が透けた入力用の画面（plugins/withQuickAddActivity.js が作る。手で直さない） */
class QuickAddActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }

  override fun getMainComponentName(): String = "quickadd"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
      this,
      BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
      object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {}
    )
  }

  /** JS の BackHandler.exitApp() や戻るボタンで、この画面を閉じてホーム画面に戻る */
  override fun invokeDefaultOnBackPressed() {
    finish()
  }
}
`;
}

const withQuickAddSource = (config) =>
  withDangerousMod(config, [
    'android',
    async (config) => {
      const packageName = config.android?.package;
      const dir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/java', ...packageName.split('.'));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'QuickAddActivity.kt'), activitySource(packageName));
      return config;
    },
  ]);

const withQuickAddManifest = (config) =>
  withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    application.activity = (application.activity ?? []).filter((a) => a.$['android:name'] !== '.QuickAddActivity');
    application.activity.push({
      $: {
        'android:name': '.QuickAddActivity',
        'android:theme': `@style/${THEME}`,
        'android:exported': 'true',
        'android:launchMode': 'singleTask',
        'android:taskAffinity': `${config.android?.package}.quick`,
        'android:excludeFromRecents': 'true',
        'android:windowSoftInputMode': 'adjustResize',
        'android:screenOrientation': 'portrait',
        'android:configChanges':
          'keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode|smallestScreenSize|assetsPaths',
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
          category: [
            { $: { 'android:name': 'android.intent.category.DEFAULT' } },
            { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
          ],
          data: [{ $: { 'android:scheme': 'kakeibo-quick' } }],
        },
      ],
    });
    return config;
  });

const withQuickAddTheme = (config) =>
  withAndroidStyles(config, (config) => {
    const styles = config.modResults;
    styles.resources.style = (styles.resources.style ?? []).filter((s) => s.$.name !== THEME);
    styles.resources.style.push({
      $: { name: THEME, parent: 'Theme.AppCompat.DayNight.NoActionBar' },
      item: [
        { $: { name: 'android:windowIsTranslucent' }, _: 'true' },
        { $: { name: 'android:windowBackground' }, _: '@android:color/transparent' },
        { $: { name: 'android:windowNoTitle' }, _: 'true' },
        { $: { name: 'android:statusBarColor' }, _: '@android:color/transparent' },
        { $: { name: 'android:navigationBarColor' }, _: '@android:color/transparent' },
        { $: { name: 'android:windowAnimationStyle' }, _: '@android:style/Animation.Translucent' },
      ],
    });
    return config;
  });

module.exports = (config) => withQuickAddTheme(withQuickAddManifest(withQuickAddSource(config)));

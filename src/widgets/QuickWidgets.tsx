import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

// ホーム画面のウィジェット（要件 REQ-15。react-native-android-widget）。1×1 の丸いボタンで、押すと
// 背景が透けた入力用の画面（QuickAddActivity）を開く。色はアプリのテーマの primary / primaryContainer
const PRIMARY = '#24466f';
const CONTAINER = '#dce6f3';

const icon = (path: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${PRIMARY}" d="${path}"/></svg>`;
// Material Design Icons の pencil と camera
const PENCIL =
  'M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z';
const CAMERA =
  'M4,4H7L9,2H15L17,4H20A2,2 0 0,1 22,6V18A2,2 0 0,1 20,20H4A2,2 0 0,1 2,18V6A2,2 0 0,1 4,4M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9Z';

function QuickButton({ path, label, uri }: { path: string; label: string; uri: string }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: CONTAINER,
        borderRadius: 24,
      }}
    >
      <SvgWidget svg={icon(path)} style={{ height: 28, width: 28 }} />
      <TextWidget text={label} style={{ fontSize: 12, color: PRIMARY, marginTop: 2 }} />
    </FlexWidget>
  );
}

/** 手入力: ホーム画面の上に入力シートを出す */
export function QuickAddWidget() {
  return <QuickButton path={PENCIL} label="記録" uri="kakeibo-quick://add" />;
}

/** 写真: カメラを開き、撮ったら自動で記録する */
export function QuickPhotoWidget() {
  return <QuickButton path={CAMERA} label="写真" uri="kakeibo-quick://photo" />;
}

import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { QuickAddWidget, QuickPhotoWidget } from './QuickWidgets';

/** app.json の react-native-android-widget の widgets の name と、描く部品 */
export const WIDGETS = { QuickAdd: QuickAddWidget, QuickPhoto: QuickPhotoWidget } as const;

/** ウィジェットを置いた・大きさを変えた・描き直すときに描く（押したときは URI を開くので、ここには来ない） */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const Widget = WIDGETS[props.widgetInfo.widgetName as keyof typeof WIDGETS];
  if (!Widget) return;
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(<Widget />);
      break;
    default:
      break;
  }
}

import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

/** 写真・PDF などは base64 で送る。大きすぎると送れないので、この大きさまで */
const MAX_BASE64 = 8_000_000;
/** 1回に読み取るファイルの数 */
const MAX_FILES = 5;
/** テキストのファイルは、この文字数まで */
const MAX_TEXT = 150_000;

/** AI入力で読み取るもの。CSV・JSON・テキストは文として、画像・PDF は base64 で送る */
export type Attachment = { key: string; name: string } & (
  { kind: 'file'; mimeType: string; data: string } | { kind: 'text'; text: string }
);

const isTextFile = (name: string, mimeType?: string) =>
  /^text\//.test(mimeType ?? '') || /json|csv/.test(mimeType ?? '') || /\.(csv|json|txt|tsv)$/i.test(name);

/** AI入力の、写真を撮る・画像を選ぶ・ファイルを選ぶ。読み込めなかったときは error に理由 */
export function useAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const add = (next: Attachment) => {
    setError(null);
    setAttachments((list) => [...list, next].slice(0, MAX_FILES));
  };

  const addImage = async (camera: boolean) => {
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
        setError('カメラを使う許可がありません');
        return;
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.6 };
      const result = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.base64) return;
      if (asset.base64.length > MAX_BASE64) {
        setError('画像が大きすぎます');
        return;
      }
      add({
        key: asset.uri,
        name: asset.fileName ?? '写真',
        kind: 'file',
        mimeType: asset.mimeType ?? 'image/jpeg',
        data: asset.base64,
      });
    } catch {
      setError('画像を読み込めませんでした');
    }
  };

  const addFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/*', 'application/json', 'application/pdf', 'image/*', 'text/csv', 'text/comma-separated-values'],
        copyToCacheDirectory: true,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      const file = new File(asset.uri);
      if (isTextFile(asset.name, asset.mimeType)) {
        add({ key: asset.uri, name: asset.name, kind: 'text', text: (await file.text()).slice(0, MAX_TEXT) });
        return;
      }
      const data = await file.base64();
      if (data.length > MAX_BASE64) {
        setError('ファイルが大きすぎます');
        return;
      }
      add({ key: asset.uri, name: asset.name, kind: 'file', mimeType: asset.mimeType ?? 'application/pdf', data });
    } catch {
      setError('ファイルを読み込めませんでした');
    }
  };

  return {
    attachments,
    error,
    setError,
    addImage,
    addFile,
    remove: (key: string) => setAttachments((list) => list.filter((a) => a.key !== key)),
    clear: () => setAttachments([]),
  };
}

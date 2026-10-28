import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

import { toJpegBase64 } from './image';

/** 写真・PDF などは base64 で送る。大きすぎると送れないので、この大きさまで */
const MAX_BASE64 = 8_000_000;
/** 1回に読み取るファイルの数（Edge Function ai-chat の extract も同じ数まで受け取る） */
export const MAX_FILES = 10;
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

  const add = (...next: Attachment[]) => {
    setError(null);
    setAttachments((list) => {
      if (list.length + next.length > MAX_FILES) setError(`1回に読み取れるのは${MAX_FILES}件までです`);
      return [...list, ...next].slice(0, MAX_FILES);
    });
  };

  /**
   * 写真を撮る・画像を選ぶ。画像はいくつでも選べる（2026-10-28 ユーザーの要望）。
   * 何枚も送っても大きくなりすぎないよう、横幅 1024px の JPEG に縮めて送る（ai/image.ts）
   */
  const addImage = async (camera: boolean) => {
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
        setError('カメラを使う許可がありません');
        return;
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsMultipleSelection: true,
            selectionLimit: MAX_FILES,
            orderedSelection: true,
          });
      if (result.canceled || !result.assets?.length) return;
      const images = await Promise.all(
        result.assets.map(async (asset, i): Promise<Attachment> => ({
          key: `${asset.uri}#${Date.now()}-${i}`,
          name: asset.fileName ?? '写真',
          kind: 'file',
          mimeType: 'image/jpeg',
          data: await toJpegBase64(asset.uri, asset.width),
        })),
      );
      add(...images);
    } catch {
      setError('画像を読み込めませんでした');
    }
  };

  const addFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/*', 'application/json', 'application/pdf', 'image/*', 'text/csv', 'text/comma-separated-values'],
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const files: Attachment[] = [];
      for (const asset of result.assets) {
        const file = new File(asset.uri);
        if (isTextFile(asset.name, asset.mimeType)) {
          files.push({ key: asset.uri, name: asset.name, kind: 'text', text: (await file.text()).slice(0, MAX_TEXT) });
          continue;
        }
        const data = await file.base64();
        if (data.length > MAX_BASE64) {
          setError(`${asset.name} は大きすぎます`);
          continue;
        }
        files.push({ key: asset.uri, name: asset.name, kind: 'file', mimeType: asset.mimeType ?? 'application/pdf', data });
      }
      add(...files);
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

import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

/** AI に送る写真の幅（文字が読める大きさまで小さくして送る。何枚も送っても大きくなりすぎないように） */
const SEND_WIDTH = 1024;

/** 写真を小さくして base64 の JPEG にする（AI入力・写真からの記録・ウィジェットの写真） */
export async function toJpegBase64(uri: string, width: number): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  if (width > SEND_WIDTH) context.resize({ width: SEND_WIDTH });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (saved.base64) return saved.base64;
  return new File(saved.uri).base64();
}

/**
 * 貼り付けた画像（data: で始まる base64）を、送る大きさの JPEG にする（AI 相談の画像の貼り付け。2026-11-24）。
 * スマホは一度ファイルに書いてから縮める（縮める部品が data: の URI を読めないため）。Web はそのまま読める
 */
export async function dataUriToJpegBase64(dataUri: string, width: number): Promise<string> {
  if (Platform.OS === 'web') return toJpegBase64(dataUri, width);
  const file = new File(Paths.cache, `paste-${Date.now()}.img`);
  file.create({ overwrite: true });
  file.write(dataUri.replace(/^data:[^,]*,/, ''), { encoding: 'base64' });
  try {
    return await toJpegBase64(file.uri, width);
  } finally {
    file.delete();
  }
}

import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

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

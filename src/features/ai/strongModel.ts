/**
 * 強いモデル（Claude Sonnet）で答えさせる質問か（2026-11-24 ユーザーの指定: 必要なときは強いモデルに切り替える。
 * 軽いモデルで明細の照らし合わせ・残高のズレの計算を間違えた）。Claude のキーがないときはサーバーが今のモデルのまま答える
 * - 今の質問に画像が付いている
 * - 照らし合わせ・漏れ・重複・ズレ・計算・原因の分析などの言葉がある
 * - 長い質問（貼り付けた一覧など）
 */
const HARD_WORDS =
  /照らし合わせ|突き合わせ|照合|漏れ|重複|ずれ|ズレ|合わない|合って|計算|明細|通帳|取引履歴|残高調整|原因|分析|整理|比較|見直/;
const LONG_QUESTION = 300;

export function needsStrongModel(question: string, imageCount: number): boolean {
  return imageCount > 0 || question.length >= LONG_QUESTION || HARD_WORDS.test(question);
}

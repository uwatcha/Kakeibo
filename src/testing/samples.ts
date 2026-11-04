// テストで使う人・お店などの名前。実際に使っている名前で確かめたいときは .env.local に書く（jest.env.js が読む）。
// 書いていなければ、ここの仮の名前でテストする

const or = (value: string | undefined, fallback: string) => (value?.trim() ? value.trim() : fallback);

export const SAMPLE = {
  /** お金を貸している相手 */
  friend: or(process.env.SAMPLE_FRIEND_NAME, '健太'),
  /** 貸し借りの相手（残高 0 円） */
  friend2: or(process.env.SAMPLE_FRIEND_NAME_2, 'さくら'),
  /** 銀行の入金の振込人（カタカナ） */
  remitter: or(process.env.SAMPLE_REMITTER_NAME, 'ヤマダ タロウ'),
  /** 収入元（働き先） */
  employer: or(process.env.SAMPLE_EMPLOYER_NAME, 'acmeworks'),
  /** 普段使わない現金の口座 */
  reservedAccount: or(process.env.SAMPLE_RESERVED_ACCOUNT_NAME, 'サークルの財布'),
};

import { extractRecordRequest, RECORD_BLOCK } from './recordRequest';

describe('extractRecordRequest', () => {
  it('記録の囲みの中身を取り出す', () => {
    const reply = `入力の画面で確かめて保存してください。\n\n\`\`\`${RECORD_BLOCK}\n1. 2026-11-20 支払い 500円 財布 内容: パン\n\`\`\`\n`;
    expect(extractRecordRequest(reply)).toBe('1. 2026-11-20 支払い 500円 財布 内容: パン');
  });

  it('囲みがない・空なら null（ほかの言語のコードの囲みは見ない）', () => {
    expect(extractRecordRequest('今月は食費が多めです')).toBeNull();
    expect(extractRecordRequest('```js\nconst a = 1\n```')).toBeNull();
    expect(extractRecordRequest(`\`\`\`${RECORD_BLOCK}\n\n\`\`\``)).toBeNull();
  });
});

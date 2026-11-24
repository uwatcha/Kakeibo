import { MAX_SENT_IMAGES, remaskHistory, toAiMessages } from './chatHistory';

describe('toAiMessages', () => {
  it('画像は JPEG として付ける', () => {
    expect(toAiMessages([{ role: 'user', sent: 'これは？', images: ['AAA'] }])).toEqual([
      { role: 'user', text: 'これは？', files: [{ mimeType: 'image/jpeg', data: 'AAA' }] },
    ]);
  });

  it('画像がなければ files を付けない', () => {
    expect(toAiMessages([{ role: 'model', sent: 'はい', images: null }])).toEqual([{ role: 'model', text: 'はい' }]);
  });

  it('最後の質問の画像は全部。前の画像は新しいほうから上限まで、古い画像は印だけ', () => {
    const old = Array.from({ length: MAX_SENT_IMAGES + 2 }, (_, i) => `old${i}`);
    const latest = Array.from({ length: 12 }, (_, i) => `new${i}`);
    const out = toAiMessages([
      { role: 'user', sent: '前', images: old },
      { role: 'model', sent: '答え' },
      { role: 'user', sent: '今', images: latest },
    ]);
    expect(out[2].files).toHaveLength(12);
    expect(out[0].files).toHaveLength(MAX_SENT_IMAGES);
    expect(out[0].text).toContain('ほかに画像が2枚');
  });
});

describe('remaskHistory', () => {
  it('保存した置き換えではなく、今の置き換えで前のやりとりを置き換え直す', () => {
    const aliases = {
      toAlias: new Map([
        ['口座P', '電子マネーB'],
        ['口座S', '電子マネーD'],
      ]),
    };
    const history = [
      { role: 'user' as const, shown: '口座Pの記録を見て', sent: '電子マネーDの記録を見て' },
      { role: 'model' as const, shown: '口座Pは 102円です', sent: '電子マネーDは 102円です' },
    ];
    expect(remaskHistory(history, aliases).map((m) => m.sent)).toEqual([
      '電子マネーBの記録を見て',
      '電子マネーBは 102円です',
    ]);
  });
});

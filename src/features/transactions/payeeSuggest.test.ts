import { suggestPayees } from './payeeSuggest';

const history = ['セブン', 'ローソン', 'セブン', 'セブンカフェ', 'スーパー', 'ローソン', 'セブン'];

describe('suggestPayees', () => {
  it('入力を含むものを、よく使う順に', () => {
    expect(suggestPayees(history, 'セブ')).toEqual(['セブン', 'セブンカフェ']);
  });
  it('同数なら新しい順', () => {
    expect(suggestPayees(['B店', 'A店', 'A店', 'B店'], '店')).toEqual(['B店', 'A店']);
  });
  it('入力と同じもの・空の入力は出さない', () => {
    expect(suggestPayees(history, 'セブン')).toEqual(['セブンカフェ']);
    expect(suggestPayees(history, ' ')).toEqual([]);
  });
  it('件数を絞る', () => {
    expect(suggestPayees(['a1', 'a2', 'a3'], 'a', 2)).toEqual(['a1', 'a2']);
  });
});

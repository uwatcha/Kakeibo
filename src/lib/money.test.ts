import { formatYen, parseYen } from './money';

describe('formatYen', () => {
  it('3桁ごとにカンマを入れる', () => {
    expect(formatYen(1234567)).toBe('1,234,567円');
  });

  it('負の値（負債の残高）も表示できる', () => {
    expect(formatYen(-5000)).toBe('-5,000円');
  });
});

describe('parseYen', () => {
  it.each([
    ['1200', 1200],
    ['1,200', 1200],
    ['１２００', 1200],
    ['1200円', 1200],
  ])('%s → %d', (input, expected) => {
    expect(parseYen(input)).toBe(expected);
  });

  it.each(['', '0', '-100', '12.5', 'abc'])('%s は不正', (input) => {
    expect(parseYen(input)).toBeNull();
  });
});

import { formatSignedYen, formatYen, parseNonNegativeYen, parseYen } from './money';

describe('formatYen', () => {
  it('3桁ごとにカンマを入れる', () => {
    expect(formatYen(1234567)).toBe('1,234,567円');
  });

  it('負の値はマイナス記号（U+2212）を付ける', () => {
    expect(formatYen(-5000)).toBe('\u22125,000円');
  });
});

describe('formatSignedYen', () => {
  it('増減は必ず符号を付ける', () => {
    expect(formatSignedYen(2000)).toBe('+2,000円');
    expect(formatSignedYen(-2000)).toBe('\u22122,000円');
    expect(formatSignedYen(0)).toBe('0円');
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

describe('parseNonNegativeYen', () => {
  it.each([
    ['', 0],
    ['  ', 0],
    ['0', 0],
    ['０', 0],
    ['12,000', 12000],
  ])('%s → %d', (input, expected) => {
    expect(parseNonNegativeYen(input)).toBe(expected);
  });

  it.each(['-1', 'abc', '1.5'])('%s は不正', (input) => {
    expect(parseNonNegativeYen(input)).toBeNull();
  });
});

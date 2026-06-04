const { sortByRawHours } = require('./sort');

describe('sortByRawHours', () => {
  it('should sort two valid numbers in ascending order', () => {
    const a = { timeRaw: '10' };
    const b = { timeRaw: '20' };
    expect(sortByRawHours(a, b)).toBeLessThan(0); // 10 - 20 = -10
    expect(sortByRawHours(b, a)).toBeGreaterThan(0); // 20 - 10 = 10
  });

  it('should sort floats correctly', () => {
    const a = { timeRaw: '1.5' };
    const b = { timeRaw: '1.2' };
    expect(sortByRawHours(a, b)).toBeGreaterThan(0); // 1.5 - 1.2 = 0.3
    expect(sortByRawHours(b, a)).toBeLessThan(0); // 1.2 - 1.5 = -0.3
  });

  it('should put valid numbers before invalid numbers/NaN', () => {
    const valid = { timeRaw: '15' };
    const invalid = { timeRaw: 'Unknown' };
    expect(sortByRawHours(valid, invalid)).toBeLessThan(0); // valid before invalid -> -1
    expect(sortByRawHours(invalid, valid)).toBeGreaterThan(0); // invalid after valid -> 1
  });

  it('should return 0 when both are invalid numbers', () => {
    const invalid1 = { timeRaw: 'Unknown' };
    const invalid2 = { timeRaw: '' };
    expect(sortByRawHours(invalid1, invalid2)).toBe(0);
  });

  it('should return 0 when both are the same valid number', () => {
    const a = { timeRaw: '10' };
    const b = { timeRaw: '10' };
    expect(sortByRawHours(a, b)).toBe(0);
  });

  it('should handle undefined values', () => {
    const valid = { timeRaw: '10' };
    const invalid = { timeRaw: undefined };
    expect(sortByRawHours(valid, invalid)).toBeLessThan(0);
    expect(sortByRawHours(invalid, valid)).toBeGreaterThan(0);

    const invalid2 = { timeRaw: undefined };
    expect(sortByRawHours(invalid, invalid2)).toBe(0);
  });

  it('should handle missing properties', () => {
    const valid = { timeRaw: '10' };
    const invalid = {};
    expect(sortByRawHours(valid, invalid)).toBeLessThan(0);
    expect(sortByRawHours(invalid, valid)).toBeGreaterThan(0);
  });
});

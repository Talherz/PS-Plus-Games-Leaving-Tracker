const { test } = require('node:test');
const assert = require('node:assert');
const { formatLeaveDate } = require('./index.js');

test('formatLeaveDate', async (t) => {
  await t.test('handles null, undefined, and empty string', () => {
    assert.strictEqual(formatLeaveDate(null), 'TBD');
    assert.strictEqual(formatLeaveDate(undefined), 'TBD');
    assert.strictEqual(formatLeaveDate(''), 'TBD');
  });

  await t.test('handles literal "TBD"', () => {
    assert.strictEqual(formatLeaveDate('TBD'), 'TBD');
  });

  await t.test('handles "Month YYYY" formats (Regex match)', () => {
    assert.strictEqual(formatLeaveDate('Jun 2026'), 'Jun 15, 2026');
    assert.strictEqual(formatLeaveDate('June 2026'), 'Jun 15, 2026');
    assert.strictEqual(formatLeaveDate('September 2025'), 'Sep 15, 2025');
    assert.strictEqual(formatLeaveDate('Aug 2024'), 'Aug 15, 2024');
  });

  await t.test('handles valid date strings', () => {
    // These should parse with new Date() correctly
    // The exact string depends on standard formatting: e.g. "Jun 10, 2024"
    assert.strictEqual(formatLeaveDate('2024-06-18'), 'Jun 18, 2024');
    assert.strictEqual(formatLeaveDate('May 21, 2024'), 'May 21, 2024');
  });

  await t.test('handles invalid date strings by returning trimmed original string', () => {
    // For completely invalid strings that do not match the regex and fail new Date()
    assert.strictEqual(formatLeaveDate('Unknown Date Format'), 'Unknown Date Format');
    assert.strictEqual(formatLeaveDate('  Some weird string  '), 'Some weird string');
  });
});

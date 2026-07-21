const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { formatLeaveDate, runTracker } = require('./index.js');

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

test('runTracker fs.readFile error handling', async (t) => {
  await t.test('throws and exits on non-ENOENT read error', async (t) => {
    // Mock fetch so we bypass the network request
    t.mock.method(global, 'fetch', async () => {
      return {
        ok: true,
        text: async () => 'ColA,ColB,ColC,ColD,ColE,ColF,ColG,ColH,ColI,ColJ,ColK,ColL\n1,2,3,4,5,6,7,8,9,10,11,12\nTestGame,PS5,Extra,,,TBD,,,,80,,10'
      };
    });

    // Mock fs.promises.readFile to throw a non-ENOENT error
    t.mock.method(fs.promises, 'readFile', async () => {
      const err = new Error('Permission denied');
      err.code = 'EACCES';
      throw err;
    });

    let exitCode = null;
    t.mock.method(process, 'exit', (code) => {
      exitCode = code;
    });

    let errorMessage = null;
    t.mock.method(console, 'error', (msg, err) => {
      errorMessage = msg + ' ' + err;
    });

    await runTracker();

    assert.strictEqual(exitCode, 1);
    assert.ok(errorMessage.includes('Permission denied'));
  });

  await t.test('ignores ENOENT read error and continues', async (t) => {
    // Mock fetch so we bypass the network request
    t.mock.method(global, 'fetch', async () => {
      return {
        ok: true,
        text: async () => 'ColA,ColB,ColC,ColD,ColE,ColF,ColG,ColH,ColI,ColJ,ColK,ColL\n1,2,3,4,5,6,7,8,9,10,11,12\nTestGame,PS5,Extra,,,TBD,,,,80,,10'
      };
    });

    // Mock fs.promises.readFile to throw an ENOENT error (file not found)
    t.mock.method(fs.promises, 'readFile', async () => {
      const err = new Error('File not found');
      err.code = 'ENOENT';
      throw err;
    });

    // Also mock fs.promises.writeFile to avoid actually writing files
    let fileWritten = false;
    t.mock.method(fs.promises, 'writeFile', async () => {
      fileWritten = true;
    });

    let exitCode = null;
    t.mock.method(process, 'exit', (code) => {
      exitCode = code;
    });

    let consoleLog = null;
    t.mock.method(console, 'log', (msg) => {
      consoleLog = msg;
    });

    let consoleError = null;
    t.mock.method(console, 'error', (msg, err) => {
      consoleError = msg + ' ' + err;
    });

    await runTracker();

    // Since TEST_MODE is false and DISCORD_WEBHOOK_URL is not set for the discord fetch,
    // discordResponse.ok will be false since we are using the mocked global fetch which
    // now we mock discord webhook call also just in case.
    assert.strictEqual(exitCode, null, 'Process should not exit on ENOENT');
  });
});

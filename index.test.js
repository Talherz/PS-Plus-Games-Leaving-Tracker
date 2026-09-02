process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/test';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { formatLeaveDate, runTracker } = require('./index.js');
const { execSync } = require('child_process');

test('Discord Webhook URL validation', async (t) => {
  const runWithUrl = (url) => {
    try {
      execSync(`DISCORD_WEBHOOK_URL="${url}" node index.js`, { stdio: 'pipe' });
      return true;
    } catch (err) {
      const stderr = err.stderr ? err.stderr.toString() : '';
      if (stderr.includes("FATAL ERROR: Invalid Discord Webhook URL provided.")) {
        return false;
      }
      // If it failed for another reason (e.g. fetch failed because of a mocked or invalid real CSV), we consider the URL validation passed if it didn't output the invalid URL error.
      // But actually, running the full script might cause real network requests.
      // We can just rely on the error output.
      return true;
    }
  };

  await t.test('rejects missing URL', () => {
    try {
      execSync(`node index.js`, { stdio: 'pipe', env: { ...process.env, DISCORD_WEBHOOK_URL: '' } });
      assert.fail('Should have failed');
    } catch (err) {
      assert.ok(err.stderr.toString().includes("FATAL ERROR: No Discord Webhook URL provided"));
    }
  });

  await t.test('rejects invalid protocol', () => {
    assert.strictEqual(runWithUrl("http://discord.com/api/webhooks/123/abc"), false);
  });

  await t.test('rejects SSRF attempts', () => {
    assert.strictEqual(runWithUrl("https://discord.com@evil.com/api/webhooks/123"), false);
    assert.strictEqual(runWithUrl("https://discord.com/api/webhooks@evil.com/123"), false);
    assert.strictEqual(runWithUrl("https://evil.com/api/webhooks/123"), false);
    assert.strictEqual(runWithUrl("https://discord.com/api/webhooks/../../evil.com"), false);
  });

  await t.test('accepts valid URL', () => {
    assert.strictEqual(runWithUrl("https://discord.com/api/webhooks/123/abc"), true);
  });
});

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
      return { ok: true, headers: { get: () => '100' },
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
      return { ok: true, headers: { get: () => '100' },
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

test('runTracker CSV fetch failure', async (t) => {
  await t.test('throws and exits when CSV fetch fails', async (t) => {
    // Mock fetch to simulate a failed network request
    t.mock.method(global, 'fetch', async () => {
      return { ok: false, headers: { get: () => '100' },
        status: 404,
        statusText: 'Not Found'
      };
    });

    let exitCode = null;
    t.mock.method(process, 'exit', (code) => {
      exitCode = code;
    });

    let errorMessage = null;
    t.mock.method(console, 'error', (msg, err) => {
      errorMessage = msg + ' ' + (err || '');
    });

    await runTracker();

    assert.strictEqual(exitCode, 1);
    assert.ok(errorMessage.includes('Failed to fetch CSV: 404 Not Found'));
  });
});

test('runTracker Discord webhook failure', async (t) => {
  await t.test('logs error when Discord webhook fetch fails', async (t) => {
    // Mock fetch to succeed for CSV but fail for Discord webhook
    t.mock.method(global, 'fetch', async (url) => {
      if (typeof url === 'string' && url.includes('docs.google.com')) {
        return { ok: true, headers: { get: () => '100' },
          text: async () => 'ColA,ColB,ColC,ColD,ColE,ColF,ColG,ColH,ColI,ColJ,ColK,ColL\n1,2,3,4,5,6,7,8,9,10,11,12\nTestGame,PS5,Extra,,,TBD,,,,80,,10'
        };
      }
      return { ok: false, headers: { get: () => '100' },
        status: 500
      };
    });

    // Mock fs.promises.readFile to throw an ENOENT error (file not found) to force sending discord message
    t.mock.method(fs.promises, 'readFile', async () => {
      const err = new Error('File not found');
      err.code = 'ENOENT';
      throw err;
    });

    let consoleError = null;
    t.mock.method(console, 'error', (msg) => {
      consoleError = msg;
    });

    await runTracker();

    assert.ok(consoleError.includes('Failed to post. Discord returned code: 500'));
  });
});

test('runTracker games sorting logic', async (t) => {
  await t.test('sorts games by completion time ascending, putting NaN at the end', async (t) => {
    let capturedPayload = null;

    t.mock.method(global, 'fetch', async (url, options) => {
      if (typeof url === 'string' && url.includes('docs.google.com')) {
        return { ok: true, headers: { get: () => '100' },
          // Column L is index 11 (ColL in this mock header)
          text: async () => 'ColA,ColB,ColC,ColD,ColE,ColF,ColG,ColH,ColI,ColJ,ColK,ColL\n' +
            '1,2,3,4,5,6,7,8,9,10,11,12\n' +
            'GameUnknown,PS5,Extra,,,TBD,,,,80,,\n' +
            'Game50,PS5,Extra,,,TBD,,,,80,,50\n' +
            'Game10,PS5,Extra,,,TBD,,,,80,,10\n' +
            'GameNaN,PS5,Extra,,,TBD,,,,80,,TBD\n' +
            'Game25,PS5,Extra,,,TBD,,,,80,,25\n'
        };
      } else if (url === process.env.DISCORD_WEBHOOK_URL || options) {
        capturedPayload = JSON.parse(options.body);
        return { ok: true };
      }
    });

    // Mock fs.promises.readFile to force sending a discord message
    t.mock.method(fs.promises, 'readFile', async () => {
      const err = new Error('File not found');
      err.code = 'ENOENT';
      throw err;
    });

    // Mock fs.promises.writeFile to avoid actually writing files
    t.mock.method(fs.promises, 'writeFile', async () => {});

    // We also need to set DISCORD_WEBHOOK_URL to make sure it triggers fetch for discord
    const originalDiscordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/test';

    await runTracker();

    process.env.DISCORD_WEBHOOK_URL = originalDiscordWebhookUrl;

    assert.ok(capturedPayload, 'Payload was sent to Discord');
    const fields = capturedPayload.embeds[0].fields;

    // Check order of games in fields
    assert.strictEqual(fields.length, 5);
    assert.ok(fields[0].name.includes('Game10'), 'Game10 should be first');
    assert.ok(fields[1].name.includes('Game25'), 'Game25 should be second');
    assert.ok(fields[2].name.includes('Game50'), 'Game50 should be third');

    // Both GameUnknown (empty completion) and GameNaN ('TBD' completion) result in NaN for timeNum.
    // Their relative order is preserved from the original array due to stable sorting (in Node 12+) or might change,
    // but they should both be at the end.
    const lastTwoNames = [fields[3].name, fields[4].name];
    assert.ok(lastTwoNames.some(name => name.includes('GameUnknown')), 'GameUnknown should be at the end');
    assert.ok(lastTwoNames.some(name => name.includes('GameNaN')), 'GameNaN should be at the end');
  });

  await t.test('returns 0 when comparing two games that both have NaN timeNum', async (t) => {
    let capturedPayload = null;

    t.mock.method(global, 'fetch', async (url, options) => {
      if (typeof url === 'string' && url.includes('docs.google.com')) {
        return { ok: true, headers: { get: () => '100' },
          text: async () => 'ColA,ColB,ColC,ColD,ColE,ColF,ColG,ColH,ColI,ColJ,ColK,ColL\n' +
            '1,2,3,4,5,6,7,8,9,10,11,12\n' +
            'GameUnknown1,PS5,Extra,,,TBD,,,,80,,\n' +
            'GameUnknown2,PS5,Extra,,,TBD,,,,80,,\n'
        };
      } else if (url === process.env.DISCORD_WEBHOOK_URL || options) {
        capturedPayload = JSON.parse(options.body);
        return { ok: true };
      }
    });

    t.mock.method(fs.promises, 'readFile', async () => {
      const err = new Error('File not found');
      err.code = 'ENOENT';
      throw err;
    });

    t.mock.method(fs.promises, 'writeFile', async () => {});

    const originalDiscordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/test';

    await runTracker();

    process.env.DISCORD_WEBHOOK_URL = originalDiscordWebhookUrl;

    assert.ok(capturedPayload, 'Payload was sent to Discord');
    const fields = capturedPayload.embeds[0].fields;

    assert.strictEqual(fields.length, 2);
    // As they both evaluate to NaN, compareGamesByTime returns 0,
    // which maintains their original order in standard stable sort.
    assert.ok(fields[0].name.includes('GameUnknown1'), 'GameUnknown1 should be first');
    assert.ok(fields[1].name.includes('GameUnknown2'), 'GameUnknown2 should be second');
  });
});


test('runTracker no updates edge case', async (t) => {
  await t.test('does not send Discord message when there are no updates', async (t) => {
    let fetchCalledForDiscord = false;

    t.mock.method(global, 'fetch', async (url, options) => {
      if (typeof url === 'string' && url.includes('docs.google.com')) {
        return { ok: true, headers: { get: () => '100' },
          text: async () => 'ColA,ColB,ColC,ColD,ColE,ColF,ColG,ColH,ColI,ColJ,ColK,ColL\n1,2,3,4,5,6,7,8,9,10,11,12\nTestGame,PS5,Extra,,,TBD,,,,80,,10'
        };
      } else {
        // This would be the Discord webhook call
        fetchCalledForDiscord = true;
        return { ok: true };
      }
    });

    const expectedCurrentList = [{"name":"TestGame","date":"TBD","system":"PS5","tier":"Extra","mc":"80","time":"10 hrs","timeNum":10}];

    t.mock.method(fs.promises, 'readFile', async (filepath, encoding) => {
      if (filepath === 'saved_list.json') {
        return JSON.stringify(expectedCurrentList);
      }
      throw new Error('Unexpected file read');
    });

    let consoleLog = null;
    t.mock.method(console, 'log', (msg) => {
      consoleLog = msg;
    });

    // Make sure DISCORD_WEBHOOK_URL is set so it doesn't fail fast if it were to send (though it shouldn't)
    const originalDiscordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/test';

    await runTracker();

    process.env.DISCORD_WEBHOOK_URL = originalDiscordWebhookUrl;

    assert.strictEqual(fetchCalledForDiscord, false, 'Discord webhook should not be called');
    assert.strictEqual(consoleLog, 'No new updates to the sheet. No message sent.');
  });
});

test('runTracker empty games list edge case', async (t) => {
  await t.test('returns early without reading file or posting to Discord when games list is empty', async (t) => {
    let fetchCalledForDiscord = false;
    let readFileCalled = false;

    t.mock.method(global, 'fetch', async (url, options) => {
      if (typeof url === 'string' && url.includes('docs.google.com')) {
        return { ok: true, headers: { get: () => '100' },
          text: async () => 'ColA,ColB,ColC,ColD,ColE,ColF,ColG,ColH,ColI,ColJ,ColK,ColL\n1,2,3,4,5,6,7,8,9,10,11,12'
        };
      } else {
        fetchCalledForDiscord = true;
        return { ok: true };
      }
    });

    t.mock.method(fs.promises, 'readFile', async () => {
      readFileCalled = true;
      const err = new Error('File not found');
      err.code = 'ENOENT';
      throw err;
    });

    let writeFileCalled = false;
    t.mock.method(fs.promises, 'writeFile', async () => {
      writeFileCalled = true;
    });

    await runTracker();

    assert.strictEqual(readFileCalled, false, 'fs.promises.readFile should not be called');
    assert.strictEqual(fetchCalledForDiscord, false, 'Discord webhook should not be called');
    assert.strictEqual(writeFileCalled, false, 'fs.promises.writeFile should not be called');
  });
});

test('runTracker successful Discord webhook notification', async (t) => {
  await t.test('posts to Discord successfully and writes to saved_list.json', async (t) => {
    let discordFetchOptions = null;

    t.mock.method(global, 'fetch', async (url, options) => {
      if (typeof url === 'string' && url.includes('docs.google.com')) {
        return { ok: true, headers: { get: () => '100' },
          text: async () => 'ColA,ColB,ColC,ColD,ColE,ColF,ColG,ColH,ColI,ColJ,ColK,ColL\n1,2,3,4,5,6,7,8,9,10,11,12\nSuccessGame,PS5,Extra,,,TBD,,,,80,,10'
        };
      } else if (url === process.env.DISCORD_WEBHOOK_URL || options) {
        discordFetchOptions = options;
        return { ok: true };
      }
    });

    // Mock fs.promises.readFile to force sending a discord message
    t.mock.method(fs.promises, 'readFile', async () => {
      const err = new Error('File not found');
      err.code = 'ENOENT';
      throw err;
    });

    let writtenFilename = null;
    let writtenData = null;
    t.mock.method(fs.promises, 'writeFile', async (file, data) => {
      writtenFilename = file;
      writtenData = data;
    });

    let consoleLog = null;
    t.mock.method(console, 'log', (msg) => {
      consoleLog = msg;
    });

    const originalDiscordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/test';

    await runTracker();

    process.env.DISCORD_WEBHOOK_URL = originalDiscordWebhookUrl;

    assert.ok(discordFetchOptions, 'Fetch to Discord was called');
    assert.strictEqual(discordFetchOptions.method, 'POST');
    assert.strictEqual(writtenFilename, 'saved_list.json');
    assert.ok(writtenData, 'Data was written to saved_list.json');

    const parsedWrittenData = JSON.parse(writtenData);
    assert.strictEqual(parsedWrittenData.length, 1);
    assert.strictEqual(parsedWrittenData[0].name, 'SuccessGame');

    assert.strictEqual(consoleLog, 'Message successfully posted to Discord and memory state saved.');
  });
});

test('runTracker markdown escaping', async (t) => {
  await t.test('escapes Discord markdown characters in game names and fields', async (t) => {
    let capturedPayload = null;

    t.mock.method(global, 'fetch', async (url, options) => {
      if (typeof url === 'string' && url.includes('docs.google.com')) {
        return { ok: true, headers: { get: () => '100' },
          // name, system, tier, ..., metacritic, completion
          // Game Name (Col A), System (Col B), Tier (Col C), ... Metacritic (Col J), Completion (Col L)
          text: async () => 'ColA,ColB,ColC,ColD,ColE,ColF,ColG,ColH,ColI,ColJ,ColK,ColL\n' +
            '1,2,3,4,5,6,7,8,9,10,11,12\n' +
            '*Markdown_Game~[1]`,_PS5*,~Extra~,,,TBD,,,,*80*,,~10~'
        };
      } else if (url === process.env.DISCORD_WEBHOOK_URL || options) {
        capturedPayload = JSON.parse(options.body);
        return { ok: true };
      }
    });

    // Mock fs.promises.readFile to force sending a discord message
    t.mock.method(fs.promises, 'readFile', async () => {
      const err = new Error('File not found');
      err.code = 'ENOENT';
      throw err;
    });

    // Mock fs.promises.writeFile to avoid actually writing files
    t.mock.method(fs.promises, 'writeFile', async () => {});

    let consoleLog = null;
    t.mock.method(console, 'log', (msg) => {
      consoleLog = msg;
    });

    const originalDiscordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/test';

    await runTracker();

    process.env.DISCORD_WEBHOOK_URL = originalDiscordWebhookUrl;

    assert.ok(capturedPayload, 'Payload was sent to Discord');
    const fields = capturedPayload.embeds[0].fields;
    assert.strictEqual(fields.length, 1);

    const fieldName = fields[0].name;
    const fieldValue = fields[0].value;

    // Check that markdown chars are escaped
    assert.ok(fieldName.includes('\\*Markdown\\_Game\\~\\[1\\]\\`'), 'Game name should have escaped markdown chars');
    assert.ok(fieldValue.includes('\\_PS5\\*'), 'System should be escaped');
    assert.ok(fieldValue.includes('\\~Extra\\~'), 'Tier should be escaped');
    assert.ok(fieldValue.includes('\\*80\\*'), 'Metacritic should be escaped');
    assert.ok(fieldValue.includes('\\~10\\~ hrs'), 'Completion time should be escaped');
  });
});

test('runTracker string truncation', async (t) => {
  await t.test('truncates strings that exceed Discord embed field limits (256/1024)', async (t) => {
    let capturedPayload = null;

    // 256 is the limit for field name. "**" around it is 4 chars. Game name must be > 252
    const longGameName = 'A'.repeat(300);
    // 1024 is the limit for field value
    const longSystem = 'B'.repeat(1000);

    t.mock.method(global, 'fetch', async (url, options) => {
      if (typeof url === 'string' && url.includes('docs.google.com')) {
        return { ok: true, headers: { get: () => '100' },
          text: async () => 'ColA,ColB,ColC,ColD,ColE,ColF,ColG,ColH,ColI,ColJ,ColK,ColL\n' +
            '1,2,3,4,5,6,7,8,9,10,11,12\n' +
            `${longGameName},${longSystem},Extra,,,TBD,,,,80,,10`
        };
      } else if (url === process.env.DISCORD_WEBHOOK_URL || options) {
        capturedPayload = JSON.parse(options.body);
        return { ok: true };
      }
    });

    t.mock.method(fs.promises, 'readFile', async () => {
      const err = new Error('File not found');
      err.code = 'ENOENT';
      throw err;
    });

    t.mock.method(fs.promises, 'writeFile', async () => {});

    t.mock.method(console, 'log', () => {});

    const originalDiscordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/test';

    await runTracker();

    process.env.DISCORD_WEBHOOK_URL = originalDiscordWebhookUrl;

    assert.ok(capturedPayload, 'Payload was sent to Discord');
    const fields = capturedPayload.embeds[0].fields;
    assert.strictEqual(fields.length, 1);

    const fieldName = fields[0].name;
    const fieldValue = fields[0].value;

    assert.ok(fieldName.length <= 256, `Field name length should be <= 256, but got ${fieldName.length}`);
    assert.ok(fieldName.endsWith('...'), 'Truncated field name should end with "..."');

    assert.ok(fieldValue.length <= 1024, `Field value length should be <= 1024, but got ${fieldValue.length}`);
    assert.ok(fieldValue.endsWith('...'), 'Truncated field value should end with "..."');
  });
});

test('runTracker CSV parsing failure', async (t) => {
  await t.test('throws and exits when CSV parsing fails', async (t) => {
    // Mock fetch to simulate a malformed CSV that throws during parsing
    t.mock.method(global, 'fetch', async (url, options) => {
      return { ok: true, headers: { get: () => '100' },
        text: async () => 'Col1,Col2\n"unclosed quote'
      };
    });

    let exitCode = null;
    t.mock.method(process, 'exit', (code) => {
      exitCode = code;
    });

    let errorMessage = null;
    t.mock.method(console, 'error', (msg, err) => {
      errorMessage = msg + ' ' + (err || '');
    });

    const originalDiscordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/test';

    await runTracker();

    process.env.DISCORD_WEBHOOK_URL = originalDiscordWebhookUrl;

    assert.strictEqual(exitCode, 1);
    assert.ok(errorMessage.includes('Quote Not Closed') || errorMessage.includes('Fatal Operational Error'), 'Should log CSV parsing error');
  });
});

test('runTracker skips #N/A games', async (t) => {
  await t.test('ignores rows where the game name is #N/A', async (t) => {
    let fetchCalledForDiscord = false;
    let readFileCalled = false;
    let capturedPayload = null;

    t.mock.method(global, 'fetch', async (url, options) => {
      if (typeof url === 'string' && url.includes('docs.google.com')) {
        return { ok: true, headers: { get: () => '100' },
          text: async () => 'ColA,ColB,ColC,ColD,ColE,ColF,ColG,ColH,ColI,ColJ,ColK,ColL\n' +
            '1,2,3,4,5,6,7,8,9,10,11,12\n' +
            '#N/A,N/A,#N/A,,,TBD,,,,#N/A,,'
        };
      } else {
        fetchCalledForDiscord = true;
        capturedPayload = JSON.parse(options.body);
        return { ok: true };
      }
    });

    t.mock.method(fs.promises, 'readFile', async () => {
      readFileCalled = true;
      const err = new Error('File not found');
      err.code = 'ENOENT';
      throw err;
    });

    let writeFileCalled = false;
    t.mock.method(fs.promises, 'writeFile', async () => {
      writeFileCalled = true;
    });

    await runTracker();

    assert.strictEqual(fetchCalledForDiscord, false, 'Discord webhook should not be called');
    assert.strictEqual(writeFileCalled, false, 'fs.promises.writeFile should not be called');
  });
});

test('runTracker 25 games limit', async (t) => {
  await t.test('limits embed fields to a maximum of 25 when there are more than 25 leaving games', async (t) => {
    let capturedPayload = null;
    let fetchCalledForDiscord = false;

    // Generate CSV data for 30 games
    let csvData = 'ColA,ColB,ColC,ColD,ColE,ColF,ColG,ColH,ColI,ColJ,ColK,ColL\n' +
                  '1,2,3,4,5,6,7,8,9,10,11,12\n';

    for (let i = 1; i <= 30; i++) {
      csvData += `Game${i},PS5,Extra,,,TBD,,,,80,,10\n`;
    }

    t.mock.method(global, 'fetch', async (url, options) => {
      if (typeof url === 'string' && url.includes('docs.google.com')) {
        return { ok: true, headers: { get: () => '100' },
          text: async () => csvData
        };
      } else if (url === process.env.DISCORD_WEBHOOK_URL || options) {
        fetchCalledForDiscord = true;
        capturedPayload = JSON.parse(options.body);
        return { ok: true };
      }
    });

    t.mock.method(fs.promises, 'readFile', async () => {
      const err = new Error('File not found');
      err.code = 'ENOENT';
      throw err;
    });

    t.mock.method(fs.promises, 'writeFile', async () => {});
    t.mock.method(console, 'log', () => {});

    const originalDiscordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/test';

    await runTracker();

    process.env.DISCORD_WEBHOOK_URL = originalDiscordWebhookUrl;

    assert.ok(fetchCalledForDiscord, 'Discord webhook should be called');
    assert.ok(capturedPayload, 'Payload should be sent to Discord');

    const fields = capturedPayload.embeds[0].fields;
    assert.strictEqual(fields.length, 25, 'Embed fields should be limited to 25');
  });
});


test('fetchCSV security mitigations', async (t) => {
  await t.test('throws an error if response is too large', async (t) => {
    t.mock.method(global, 'fetch', async () => {
      return {
        ok: true,
        headers: {
          get: (name) => name.toLowerCase() === 'content-length' ? '10000000' : null
        },
        text: async () => 'huge response'
      };
    });

    const { fetchCSV } = require('./index.js');
    await assert.rejects(
      async () => await fetchCSV('http://example.com'),
      { message: 'Response too large: 10000000 bytes' }
    );
  });

  await t.test('throws an error on timeout (AbortError)', async (t) => {
    t.mock.method(global, 'fetch', async (url, options) => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    });

    const { fetchCSV } = require('./index.js');
    await assert.rejects(
      async () => await fetchCSV('http://example.com'),
      { message: 'Request timeout' }
    );
  });
});


test('postToDiscord security mitigations', async (t) => {
  await t.test('handles timeout (AbortError)', async (t) => {
    t.mock.method(global, 'fetch', async (url, options) => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    });

    const { postToDiscord } = require('./index.js');
    const result = await postToDiscord([{name: 'Test', date: 'TBD', system: 'PS5', tier: 'Extra', mc: '80', time: '10'}]);
    assert.strictEqual(result, false, 'postToDiscord should return false on timeout');
  });
});

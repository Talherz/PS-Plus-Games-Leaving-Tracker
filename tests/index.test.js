// Set environment variables before requiring the module
process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test';

const { runTracker } = require('../index');

describe('runTracker', () => {
  let originalFetch;
  let originalExit;
  let originalConsoleError;

  beforeAll(() => {
    originalFetch = global.fetch;
    originalExit = process.exit;
    originalConsoleError = console.error;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    process.exit = originalExit;
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    global.fetch = jest.fn();
    process.exit = jest.fn();
    console.error = jest.fn();
  });

  it('should handle fetch error when CSV response is not ok', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    await runTracker();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      "Fatal Operational Error:",
      expect.objectContaining({ message: 'Failed to fetch CSV: 500 Internal Server Error' })
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should handle network error during fetch', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network failure'));

    await runTracker();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      "Fatal Operational Error:",
      expect.objectContaining({ message: 'Network failure' })
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});

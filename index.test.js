const { runTracker } = require('./index');
const fs = require('fs');

describe('runTracker', () => {
  let originalFetch;
  let originalConsoleError;
  let originalConsoleLog;
  let originalExit;

  beforeAll(() => {
    // Keep a reference to the original so we can restore later
    originalFetch = global.fetch;
    originalConsoleError = console.error;
    originalConsoleLog = console.log;
    originalExit = process.exit;
  });

  beforeEach(() => {
    // Set up environment variable
    process.env.DISCORD_WEBHOOK_URL = 'http://mock-discord-webhook.com';

    // Mock console methods
    console.error = jest.fn();
    console.log = jest.fn();

    // Mock process.exit
    process.exit = jest.fn();

    // Clear the saved_list.json if it exists to ensure a fresh test state
    if (fs.existsSync('saved_list.json')) {
      fs.unlinkSync('saved_list.json');
    }
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    process.exit = originalExit;
  });

  it('should log an error when the Discord webhook returns a 500 error', async () => {
    // Mock the global fetch function
    global.fetch = jest.fn((url) => {
      // Mock for CSV fetch
      if (url.includes('docs.google.com')) {
        const mockCsvData = "Game,Platform,Tier,Added,Removed,Date,Metacritic,Completion,Hours,Extra1,Extra2,Extra3\n1,2,3,4,5,6,7,8,9,10,11,12\nTest Game,PS5,Extra,Jan 2024,Feb 2024,Feb 15 2024,80,10,10,80,10,10\n";
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(mockCsvData)
        });
      }

      // Mock for Discord webhook POST
      if (url === 'http://mock-discord-webhook.com') {
        return Promise.resolve({
          ok: false,
          status: 500
        });
      }

      return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
    });

    // Run the tracker
    await runTracker();

    // Verify the correct console error was logged
    expect(console.error).toHaveBeenCalledWith('Failed to post. Discord returned code: 500');

    // Verify that the webhook was actually called
    expect(global.fetch).toHaveBeenCalledWith(
      'http://mock-discord-webhook.com',
      expect.objectContaining({
        method: 'POST'
      })
    );
  });
});

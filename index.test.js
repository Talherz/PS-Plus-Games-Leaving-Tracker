const { runTracker } = require('./index.js');
const fs = require('fs');

jest.mock('fs');

global.fetch = jest.fn();

describe('runTracker', () => {
  const mockCsvData = `Game,System,Tier,Status,LeaveDateRaw,LeaveDate,Date,Added,AddedDateRaw,Metacritic,HowLongToBeat,Completion,Notes
AnotherHeader,,,,,,,,,,,,
Game A,PS4,Extra,,TBD,12/15/2023,"Dec 15, 2023","Oct 18, 2022",,85,HowLongToBeat,20,
Game B,PS5,Premium,,TBD,January 2024,"Jan 15, 2024","Nov 15, 2022",,90,HowLongToBeat,50.5,
Game C,PS4,Extra,,TBD,TBD,TBD,"Dec 20, 2022",,70,HowLongToBeat,,`;

  const expectedParsedData = [
    {
      name: 'Game A',
      date: 'Dec 15, 2023',
      system: 'PS4',
      tier: 'Extra',
      mc: '85',
      time: '20 hrs',
      timeRaw: '20'
    },
    {
      name: 'Game B',
      date: 'Jan 15, 2024',
      system: 'PS5',
      tier: 'Premium',
      mc: '90',
      time: '50.5 hrs',
      timeRaw: '50.5'
    },
    {
      name: 'Game C',
      date: 'TBD',
      system: 'PS4',
      tier: 'Extra',
      mc: '70',
      time: 'Unknown',
      timeRaw: ''
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  it('throws an error if no webhookUrl is provided', async () => {
    await expect(runTracker(undefined)).rejects.toThrow('No Discord Webhook URL provided.');
  });

  it('exits if no games are leaving (empty csv)', async () => {
    fetch.mockResolvedValueOnce({
      text: jest.fn().mockResolvedValue('Game,System,Tier,Status,LeaveDateRaw,LeaveDate,Date,Added,AddedDateRaw,Metacritic,HowLongToBeat,Completion,Notes\n'),
    });

    await runTracker('dummy_webhook_url');

    expect(fetch).toHaveBeenCalledTimes(1); // Only fetch CSV
  });

  it('posts message to Discord when there are new games', async () => {
    fetch.mockResolvedValueOnce({
      text: jest.fn().mockResolvedValue(mockCsvData),
    });

    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    fs.existsSync.mockReturnValueOnce(false); // No saved list

    await runTracker('dummy_webhook_url');

    expect(fetch).toHaveBeenCalledTimes(2); // fetch CSV + fetch Discord Webhook
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);

    const [webhookCallUrl, webhookCallOpts] = fetch.mock.calls[1];
    expect(webhookCallUrl).toBe('dummy_webhook_url');

    const payload = JSON.parse(webhookCallOpts.body);
    expect(payload.embeds[0].fields).toHaveLength(3);
    expect(payload.embeds[0].description).toContain('Dec 15, 2023'); // Sort puts Game A first? wait, sorting logic ascending based on raw hours.
    // Game A: 20
    // Game B: 50.5
    // Game C: ''
    // Game A should be first.
  });

  it('does not post to Discord if games list is unchanged', async () => {
     fetch.mockResolvedValueOnce({
      text: jest.fn().mockResolvedValue(mockCsvData),
    });

    // We need to mock the sorting logic outcome
    const sortedData = [...expectedParsedData].sort((a, b) => {
        const timeA = parseFloat(a.timeRaw);
        const timeB = parseFloat(b.timeRaw);

        const isNumA = !isNaN(timeA);
        const isNumB = !isNaN(timeB);

        if (isNumA && isNumB) {
            return timeA - timeB;
        } else if (isNumA && !isNumB) {
            return -1;
        } else if (!isNumA && isNumB) {
            return 1;
        } else {
            return 0;
        }
    });

    fs.existsSync.mockReturnValueOnce(true);
    fs.readFileSync.mockReturnValueOnce(JSON.stringify(sortedData));

    await runTracker('dummy_webhook_url');

    expect(fetch).toHaveBeenCalledTimes(1); // Only fetch CSV, no webhook call
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('logs an error if Discord webhook fails', async () => {
      fetch.mockResolvedValueOnce({
          text: jest.fn().mockResolvedValue(mockCsvData),
      });

      fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
      });

      fs.existsSync.mockReturnValueOnce(false);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await runTracker('dummy_webhook_url');

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to post. Discord returned code: 500');

      consoleErrorSpy.mockRestore();
  });
});
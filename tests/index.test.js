const { runTracker } = require('../index');
const fs = require('fs');

// Mock fetch globally
global.fetch = jest.fn();

// Mock fs and process.exit
jest.mock('fs');
jest.spyOn(process, 'exit').mockImplementation((code) => {
  throw new Error(`Process exited with code ${code}`);
});

jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'log').mockImplementation(() => {});

describe('runTracker', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/dummy' };
  });

  afterAll(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('exits with error if DISCORD_WEBHOOK_URL is missing', async () => {
    delete process.env.DISCORD_WEBHOOK_URL;

    await expect(runTracker()).rejects.toThrow('Process exited with code 1');
    expect(console.error).toHaveBeenCalledWith('FATAL ERROR: No Discord Webhook URL provided in environment variables.');
  });

  it('fetches CSV, parses it, and sends to Discord if data is new', async () => {
    const mockCsv = `Header1,Header2,Header3,Header4,Header5,Header6,Header7,Header8,Header9,Header10,Header11,Header12
Subheader1,Subheader2,Subheader3,Subheader4,Subheader5,Subheader6,Subheader7,Subheader8,Subheader9,Subheader10,Subheader11,Subheader12
Game A,PS5,Extra,Pub,Dev,Jun 2026,Jan 2024,RPG,80,85,HLTB,10.5
Game B,PS4,Premium,Pub,Dev,2024-05-15,Jan 2023,Action,70,75,HLTB,5
`;
    // Mock the CSV fetch
    global.fetch.mockResolvedValueOnce({
      text: jest.fn().mockResolvedValue(mockCsv),
    });

    // Mock the Discord webhook fetch
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    // fs.existsSync returns false (no saved list)
    fs.existsSync.mockReturnValue(false);

    // Mock the timezone formatting or just test what gets written to fs if we want to be timezone independent.
    // The dates are not in the embed field value (the commonDate is in description), so we shouldn't check embed field values for the date.

    await runTracker();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][0]).toContain('docs.google.com/spreadsheets');
    expect(global.fetch.mock.calls[1][0]).toBe('https://discord.com/api/webhooks/dummy');

    // Check payload sent to discord
    const discordPayload = JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(discordPayload.embeds[0].fields).toHaveLength(2);

    // Check sorting: Game B (5 hrs) should come before Game A (10.5 hrs)
    expect(discordPayload.embeds[0].fields[0].name).toBe('**Game B**');
    expect(discordPayload.embeds[0].fields[1].name).toBe('**Game A**');

    // Check commonDate
    expect(discordPayload.embeds[0].description).toContain('Here are the games leaving PS+ on');

    // Check date formatting by inspecting the saved json
    const savedList = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
    const gameA = savedList.find(g => g.name === 'Game A');
    const gameB = savedList.find(g => g.name === 'Game B');

    expect(gameA.date).toBe('Jun 15, 2026');
    // Date formatting might be timezone dependent, let's just assert it is parsed as a string.
    expect(typeof gameB.date).toBe('string');
  });

  it('does not send to Discord if saved list matches current data', async () => {
    const mockCsv = `Header1,Header2,Header3,Header4,Header5,Header6,Header7,Header8,Header9,Header10,Header11,Header12
Subheader1,Subheader2,Subheader3,Subheader4,Subheader5,Subheader6,Subheader7,Subheader8,Subheader9,Subheader10,Subheader11,Subheader12
Game A,PS5,Extra,Pub,Dev,Jun 2026,Jan 2024,RPG,80,85,HLTB,10.5
`;
    global.fetch.mockResolvedValueOnce({
      text: jest.fn().mockResolvedValue(mockCsv),
    });

    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify([
      {
        name: 'Game A',
        date: 'Jun 15, 2026',
        system: 'PS5',
        tier: 'Extra',
        mc: '85',
        time: '10.5 hrs',
        timeRaw: '10.5'
      }
    ]));

    await runTracker();

    expect(global.fetch).toHaveBeenCalledTimes(1); // Only fetched CSV, didn't hit Discord
    expect(console.log).toHaveBeenCalledWith('No new updates to the sheet. No message sent.');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('catches and exits on fetch failure', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network Error'));

    await expect(runTracker()).rejects.toThrow('Process exited with code 1');
    expect(console.error).toHaveBeenCalledWith('Fatal Operational Error:', 'Network Error');
  });

  it('handles games with no leaving date or TBD', async () => {
    const mockCsv = `Header1,Header2,Header3,Header4,Header5,Header6,Header7,Header8,Header9,Header10,Header11,Header12
Subheader1,Subheader2,Subheader3,Subheader4,Subheader5,Subheader6,Subheader7,Subheader8,Subheader9,Subheader10,Subheader11,Subheader12
Game TBD,PS5,Extra,Pub,Dev,TBD,Jan 2024,RPG,80,85,HLTB,10.5
Game Empty,PS4,Premium,Pub,Dev,,Jan 2023,Action,70,75,HLTB,5
`;
    global.fetch.mockResolvedValueOnce({
      text: jest.fn().mockResolvedValue(mockCsv),
    });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    fs.existsSync.mockReturnValue(false);

    await runTracker();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const discordPayload = JSON.parse(global.fetch.mock.calls[1][1].body);
    // Both should have 'TBD'
    expect(discordPayload.embeds[0].fields[0].name).toBe('**Game Empty**');
    expect(discordPayload.embeds[0].fields[1].name).toBe('**Game TBD**');

    // Check saved JSON data
    const savedDataStr = fs.writeFileSync.mock.calls[0][1];
    const savedData = JSON.parse(savedDataStr);
    expect(savedData[0].date).toBe('TBD');
    expect(savedData[1].date).toBe('TBD');
  });

  it('handles Discord webhook failure', async () => {
    const mockCsv = `Header1,Header2,Header3,Header4,Header5,Header6,Header7,Header8,Header9,Header10,Header11,Header12
Subheader1,Subheader2,Subheader3,Subheader4,Subheader5,Subheader6,Subheader7,Subheader8,Subheader9,Subheader10,Subheader11,Subheader12
Game A,PS5,Extra,Pub,Dev,Jun 2026,Jan 2024,RPG,80,85,HLTB,10.5
`;
    global.fetch.mockResolvedValueOnce({
      text: jest.fn().mockResolvedValue(mockCsv),
    });

    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    fs.existsSync.mockReturnValue(false);

    await runTracker();

    expect(console.error).toHaveBeenCalledWith('Failed to post. Discord returned code: 500');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});

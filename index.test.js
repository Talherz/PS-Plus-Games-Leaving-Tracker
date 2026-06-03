const { runTracker } = require('./index');

describe('runTracker', () => {
  let globalFetchMock;

  beforeEach(() => {
    // Mock the global fetch
    globalFetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (url, options) => {
      if (options && options.method === 'POST') {
        // Mock Discord webhook response
        return { ok: true, status: 200 };
      }
      // Provide an empty CSV payload for empty state
      return { text: async () => "" };
    });

    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit called with ${code}`);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should exit early and not post to Discord if CSV is empty', async () => {
    // Return an empty string to simulate an empty CSV
    globalFetchMock.mockImplementationOnce(async (url, options) => {
      return { text: async () => "" };
    });

    await runTracker();

    // fetch should only be called once for the CSV data
    expect(globalFetchMock).toHaveBeenCalledTimes(1);
    // The Discord POST request should not happen
    expect(globalFetchMock).not.toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'POST' }));
  });

  it('should exit early and not post to Discord if CSV only has headers', async () => {
    // Return a CSV that only has the first two rows (headers) and no game data
    const headersOnlyCSV = "Header1,Header2,Header3,Header4,Header5,Header6,Header7,Header8,Header9,Header10,Header11,Header12\nSubheader1,Subheader2,Subheader3,Subheader4,Subheader5,Subheader6,Subheader7,Subheader8,Subheader9,Subheader10,Subheader11,Subheader12";

    globalFetchMock.mockImplementationOnce(async (url, options) => {
      return { text: async () => headersOnlyCSV };
    });

    await runTracker();

    expect(globalFetchMock).toHaveBeenCalledTimes(1);
    expect(globalFetchMock).not.toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'POST' }));
  });

  it('should post to Discord if valid CSV data is provided and it differs from saved state', async () => {
    const validCSV = `Header1,Header2,Header3,Header4,Header5,Header6,Header7,Header8,Header9,Header10,Header11,Header12\nSub1,Sub2,Sub3,Sub4,Sub5,Sub6,Sub7,Sub8,Sub9,Sub10,Sub11,Sub12\nGame1,PS5,Premium,SomeData,SomeData,Jun 2026,SomeData,SomeData,SomeData,85,SomeData,20`;

    // Create a mock saved state so that it differs from the fresh pull
    const fs = require('fs');
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue("[]");
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    globalFetchMock.mockImplementation(async (url, options) => {
      if (options && options.method === 'POST') {
        return { ok: true, status: 200 };
      }
      return { text: async () => validCSV };
    });

    await runTracker();

    // fetch called for CSV
    // fetch called for Discord POST
    expect(globalFetchMock).toHaveBeenCalledTimes(2);
    expect(globalFetchMock).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ method: 'POST' }));
  });
});

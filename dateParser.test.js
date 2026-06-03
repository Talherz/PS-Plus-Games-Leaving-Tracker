// dateParser.test.js
const { parseLeaveDate } = require("./dateParser");

describe("parseLeaveDate", () => {
  it("should return 'TBD' if rawLeaveDate is 'TBD'", () => {
    expect(parseLeaveDate("TBD")).toBe("TBD");
  });

  it("should return 'TBD' if rawLeaveDate is undefined or empty", () => {
    expect(parseLeaveDate("")).toBe("TBD");
    expect(parseLeaveDate(undefined)).toBe("TBD");
    expect(parseLeaveDate(null)).toBe("TBD");
  });

  it("should format 'Month YYYY' to 'MMM 15, YYYY'", () => {
    expect(parseLeaveDate("Jun 2026")).toBe("Jun 15, 2026");
    expect(parseLeaveDate("June 2026")).toBe("Jun 15, 2026");
    expect(parseLeaveDate("December 2025")).toBe("Dec 15, 2025");
  });

  it("should parse and format a full date string correctly", () => {
    // Note: new Date() behavior might be slightly timezone dependent, but typical behavior:
    expect(parseLeaveDate("2025-05-20")).toBe("May 20, 2025");
    expect(parseLeaveDate("May 20, 2025")).toBe("May 20, 2025");
    expect(parseLeaveDate("05/20/2025")).toBe("May 20, 2025");
  });

  it("should return the original cleaned string if the date is invalid", () => {
    expect(parseLeaveDate("Unknown Date Format")).toBe("Unknown Date Format");
    expect(parseLeaveDate("Not A Date")).toBe("Not A Date");
  });

  it("should trim the input string before processing", () => {
    expect(parseLeaveDate("  June 2026  ")).toBe("Jun 15, 2026");
    expect(parseLeaveDate("   2025-05-20   ")).toBe("May 20, 2025");
    expect(parseLeaveDate("  Invalid Date  ")).toBe("Invalid Date");
  });
});

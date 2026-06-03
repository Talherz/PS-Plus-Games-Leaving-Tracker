/**
 * Parses and formats the raw leave date string.
 * Format Date String to match 'MMM 15, yyyy' if day is missing.
 * @param {string} rawLeaveDate
 * @returns {string} The formatted leave date.
 */
function parseLeaveDate(rawLeaveDate) {
  let leaveDate = "TBD";
  if (rawLeaveDate && rawLeaveDate !== "TBD") {
    const cleanDate = rawLeaveDate.trim();

    // Regex checks if it is just "Month YYYY" (e.g., "Jun 2026" or "June 2026")
    if (/^[a-zA-Z]+ \d{4}$/.test(cleanDate)) {
      const parts = cleanDate.split(" ");
      // Grab the first 3 letters of the month and force the 15th
      leaveDate = `${parts[0].substring(0, 3)} 15, ${parts[1]}`;
    } else {
      const d = new Date(cleanDate);
      if (!isNaN(d.getTime())) {
        leaveDate = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
      } else {
        leaveDate = cleanDate;
      }
    }
  }
  return leaveDate;
}

module.exports = {
  parseLeaveDate
};
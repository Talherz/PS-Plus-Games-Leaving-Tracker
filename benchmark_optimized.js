const { performance } = require('perf_hooks');

const COL_GAME_NAME = 0;
const COL_SYSTEM = 1;
const COL_TIER = 2;
const COL_LEAVE_DATE = 5;
const COL_METACRITIC = 9;
const COL_COMPLETION = 11;

function formatLeaveDate(rawLeaveDate) {
  return "Date";
}

const records = [];
for(let i=0; i<100000; i++) {
  const row = [];
  row[COL_GAME_NAME] = "  Game " + i + "   ";
  row[COL_SYSTEM] = " PS5 ";
  row[COL_TIER] = " Extra ";
  row[COL_LEAVE_DATE] = " Jun 2026 ";
  row[COL_METACRITIC] = " 85 ";
  row[COL_COMPLETION] = " 10 ";
  records.push(row);
}

function runLoop() {
    let leavingGamesData = [];
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const gameName = row[COL_GAME_NAME];

      if (!gameName) continue;
      const trimmedGameName = gameName.trim();
      if (trimmedGameName !== "") {
        const system = row[COL_SYSTEM] ? row[COL_SYSTEM].trim() : "N/A";
        const tier = row[COL_TIER] ? row[COL_TIER].trim() : "N/A";
        const rawLeaveDate = row[COL_LEAVE_DATE] ? row[COL_LEAVE_DATE].trim() : "TBD";
        const metacritic = row[COL_METACRITIC] ? row[COL_METACRITIC].trim() : "N/A";
        const rawCompletion = row[COL_COMPLETION] ? row[COL_COMPLETION].trim() : "";

        const leaveDate = formatLeaveDate(rawLeaveDate);

        const completion = rawCompletion ? `${rawCompletion} hrs` : "Unknown";

        leavingGamesData.push({
          name: trimmedGameName,
          date: leaveDate,
          system: system,
          tier: tier,
          mc: metacritic,
          time: completion,
          timeNum: parseFloat(rawCompletion)
        });
      }
    }
}

const start = performance.now();
for(let k=0; k<100; k++) {
    runLoop();
}
const end = performance.now();
console.log("Optimized benchmark time:", (end - start).toFixed(2), "ms");

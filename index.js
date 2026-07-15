const { parse } = require('csv-parse/sync');
const fsp = require('fs').promises;

// CSV Column Indices
const COL_GAME_NAME = 0;   // Column A
const COL_SYSTEM = 1;      // Column B
const COL_TIER = 2;        // Column C
const COL_LEAVE_DATE = 5;  // Column F
const COL_METACRITIC = 9;  // Column J
const COL_COMPLETION = 11; // Column L

// SET THIS TO true FOR TESTING, THEN BACK TO false WHEN YOU ARE DONE
const TEST_MODE = false;

// Pulls the secure webhook URL from GitHub's hidden environment variables
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

if (!DISCORD_WEBHOOK_URL) {
  console.error("FATAL ERROR: No Discord Webhook URL provided in environment variables.");
  process.exit(1);
}

if (!DISCORD_WEBHOOK_URL.startsWith("https://discord.com/api/webhooks/")) {
  console.error("FATAL ERROR: Invalid Discord Webhook URL provided. Must start with 'https://discord.com/api/webhooks/'.");
  process.exit(1);
}
const CSV_URL = "https://docs.google.com/spreadsheets/d/19RorxFhWc2lHocg4c9zrVssSwZq1u2nPcpTsAvzdJQw/export?format=csv&gid=353702390";

function formatLeaveDate(rawLeaveDate) {
  if (!rawLeaveDate || rawLeaveDate === "TBD") {
    return "TBD";
  }

  const cleanDate = rawLeaveDate.trim();

  // Regex checks if it is just "Month YYYY" (e.g., "Jun 2026" or "June 2026")
  if (/^[a-zA-Z]+ \d{4}$/.test(cleanDate)) {
    const parts = cleanDate.split(" ");
    // Grab the first 3 letters of the month and force the 15th
    return `${parts[0].substring(0, 3)} 15, ${parts[1]}`;
  }

  const d = new Date(cleanDate);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }

  return cleanDate;
}

async function runTracker() {
try {
const response = await fetch(CSV_URL);
if (!response.ok) {
  throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
}
const csvText = await response.text();

const records = parse(csvText, {
  skip_empty_lines: true
});

let leavingGamesData = [];

// Starting loop at index 2 to skip headers
for (let i = 2; i < records.length; i++) {
  const row = records[i];
  const gameName = row[COL_GAME_NAME]; // Column A
  
  if (gameName && gameName.trim() !== "") {
    const system = row[COL_SYSTEM] ? row[COL_SYSTEM].trim() : "N/A";     // Column B
    const tier = row[COL_TIER] ? row[COL_TIER].trim() : "N/A";       // Column C
    const rawLeaveDate = row[COL_LEAVE_DATE] ? row[COL_LEAVE_DATE].trim() : "TBD"; // Column F
    const metacritic = row[COL_METACRITIC] ? row[COL_METACRITIC].trim() : "N/A"; // Column J
    const rawCompletion = row[COL_COMPLETION] ? row[COL_COMPLETION].trim() : ""; // Column L

    const leaveDate = formatLeaveDate(rawLeaveDate);
    
    const completion = rawCompletion ? `${rawCompletion} hrs` : "Unknown";

    leavingGamesData.push({
      name: gameName.trim(),
      date: leaveDate,
      system: system,
      tier: tier,
      mc: metacritic,
      time: completion,
      timeRaw: rawCompletion
    });
  }
}

if (leavingGamesData.length === 0) return;

// Replicate sorting logic ascending based on raw hours
leavingGamesData.sort((a, b) => {
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

const currentListString = JSON.stringify(leavingGamesData);
let savedListString = "";

// Check local file state instead of Google PropertiesService
try {
  savedListString = await fsp.readFile('saved_list.json', 'utf8');
} catch (err) {
  if (err.code !== 'ENOENT') {
    throw err;
  }
}

if (TEST_MODE || savedListString !== currentListString) {
  
  const commonDate = leavingGamesData.length > 0 ? leavingGamesData[0].date : "TBD";
  let embedFields = [];
  
  for (let j = 0; j < leavingGamesData.length && j < 25; j++) {
    const game = leavingGamesData[j];

    let fieldName = `**${game.name}**`;
    if (fieldName.length > 256) {
      fieldName = fieldName.substring(0, 253) + '...';
    }

    let fieldValue = `Platform: ${game.system} • Tier: ${game.tier}\nMetacritic: ${game.mc} • Completion: ${game.time}`;
    if (fieldValue.length > 1024) {
      fieldValue = fieldValue.substring(0, 1021) + '...';
    }

    embedFields.push({
      "name": fieldName,
      "value": fieldValue,
      "inline": false
    });
  }

  const payload = {
    "content": "@everyone 🚨 **PS Plus Games Leaving Update!**",
    "embeds": [{
      "title": "Games Leaving PS Plus Soon",
      "url": "https://docs.google.com/spreadsheets/d/19RorxFhWc2lHocg4c9zrVssSwZq1u2nPcpTsAvzdJQw/edit#gid=353702390",
      "description": `Here are the games leaving PS+ on **${commonDate}**.`,
      "color": 16753920,
      "fields": embedFields,
      "footer": {
        "text": "Data parsed automatically from the Master List"
      },
      "timestamp": new Date().toISOString()
    }]
  };

  const discordResponse = await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (discordResponse.ok) {
    await fsp.writeFile('saved_list.json', currentListString);
    console.log("Message successfully posted to Discord and memory state saved.");
  } else {
    console.error(`Failed to post. Discord returned code: ${discordResponse.status}`);
  }
} else {
  console.log("No new updates to the sheet. No message sent.");
}
} catch (err) {
console.error("Fatal Operational Error:", err.message);
process.exit(1);
}
}

runTracker();

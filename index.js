// index.js
const { parse } = require("csv-parse/sync");
const fs = require("fs");

// SET THIS TO true FOR TESTING, THEN BACK TO false WHEN YOU ARE DONE
const TEST_MODE = false;

// Pulls the secure webhook URL from GitHub's hidden environment variables
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

if (!DISCORD_WEBHOOK_URL) {
  console.error("FATAL ERROR: No Discord Webhook URL provided in environment variables.");
  process.exit(1);
}

const CSV_URL = "https://docs.google.com/spreadsheets/d/19RorxFhWc2lHocg4c9zrVssSwZq1u2nPcpTsAvzdJQw/export?format=csv&gid=353702390";

async function runTracker() {
try {
const response = await fetch(CSV_URL);
const csvText = await response.text();

const records = parse(csvText, {
  skip_empty_lines: true
});

let leavingGamesData = [];

// Starting loop at index 2 to skip headers
for (let i = 2; i < records.length; i++) {
  const row = records[i];
  const gameName = row[0]; // Column A
  
  if (gameName && gameName.trim() !== "") {
    const system = row[1] ? row[1].trim() : "N/A";     // Column B
    const tier = row[2] ? row[2].trim() : "N/A";       // Column C
    const rawLeaveDate = row[5] ? row[5].trim() : "TBD"; // Column F
    const metacritic = row[9] ? row[9].trim() : "N/A"; // Column J
    const rawCompletion = row[11] ? row[11].trim() : ""; // Column L

    // Format Date String to match 'MMM 15, yyyy' if day is missing
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
  savedListString = await fs.promises.readFile('saved_list.json', 'utf8');
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

if (TEST_MODE || savedListString !== currentListString) {
  
  const commonDate = leavingGamesData.length > 0 ? leavingGamesData[0].date : "TBD";
  let embedFields = [];
  
  for (let j = 0; j < leavingGamesData.length && j < 25; j++) {
    const game = leavingGamesData[j];
    embedFields.push({
      "name": "**" + game.name + "**",
      "value": "Platform: " + game.system + " • Tier: " + game.tier + "\nMetacritic: " + game.mc + " • Completion: " + game.time,
      "inline": false
    });
  }

  const payload = {
    "content": "@everyone 🚨 **PS Plus Games Leaving Update!**",
    "embeds": [{
      "title": "Games Leaving PS Plus Soon",
      "url": "https://docs.google.com/spreadsheets/d/19RorxFhWc2lHocg4c9zrVssSwZq1u2nPcpTsAvzdJQw/edit#gid=353702390",
      "description": "Here are the games leaving PS+ on **" + commonDate + "**.",
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
    await fs.promises.writeFile('saved_list.json', currentListString);
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

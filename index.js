const { parse } = require('csv-parse/sync');
const fsp = require('fs').promises;

// CSV Column Indices
const COL_GAME_NAME = 0;   // Column A
const COL_SYSTEM = 1;      // Column B
const COL_TIER = 2;        // Column C
const COL_LEAVE_DATE = 5;  // Column F
const COL_METACRITIC = 9;  // Column J
const COL_COMPLETION = 11; // Column L

// Discord Embed Configuration
const ALERT_EMBED_COLOR = 16753920; // Alert yellow/orange

// SET THIS TO true FOR TESTING, THEN BACK TO false WHEN YOU ARE DONE
const TEST_MODE = false;

// Pulls the secure webhook URL from GitHub's hidden environment variables
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// Ensure environment variables are checked only when run directly
function validateWebhookUrl(url) {
  if (!url) {
    console.error("FATAL ERROR: No Discord Webhook URL provided in environment variables.");
    process.exit(1);
  }

  try {
    const parsedUrl = new URL(url);
    const webhookPathRegex = /^\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/;
    if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "discord.com" || !webhookPathRegex.test(parsedUrl.pathname)) {
      throw new Error();
    }
  } catch (err) {
    console.error("FATAL ERROR: Invalid Discord Webhook URL provided. Must be a valid 'https://discord.com/api/webhooks/' URL.");
    process.exit(1);
  }
}
const CSV_URL = "https://docs.google.com/spreadsheets/d/19RorxFhWc2lHocg4c9zrVssSwZq1u2nPcpTsAvzdJQw/export?format=csv&gid=353702390";

const DISCORD_MARKDOWN_REGEX = /([\\*_~`|<>\[\]])/g;
const DISCORD_MARKDOWN_TEST_REGEX = /[\\*_~`|<>\[\]]/;

function escapeMarkdown(text) {
  if (!text) return text;
  const str = String(text);
  if (!DISCORD_MARKDOWN_TEST_REGEX.test(str)) return str;
  // Escape Discord markdown characters
  return str.replace(DISCORD_MARKDOWN_REGEX, '\\$1');
}

function truncateString(str, maxLength) {
  if (str.length > maxLength) {
    return str.substring(0, maxLength - 3) + '...';
  }
  return str;
}

const LEAVE_DATE_REGEX = /^[a-zA-Z]{3,9} \d{4}$/;
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

function formatLeaveDate(rawLeaveDate) {
  if (!rawLeaveDate || rawLeaveDate === "TBD") {
    return "TBD";
  }

  const cleanDate = rawLeaveDate.trim();

  // Regex checks if it is just "Month YYYY" (e.g., "Jun 2026" or "June 2026")
  if (LEAVE_DATE_REGEX.test(cleanDate)) {
    const parts = cleanDate.split(" ");
    // Grab the first 3 letters of the month and force the 15th
    return `${parts[0].substring(0, 3)} 15, ${parts[1]}`;
  }

  const d = new Date(cleanDate);
  if (!isNaN(d.getTime())) {
    return dateFormatter.format(d);
  }

  return cleanDate;
}

async function fetchCSV(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
  }
  return await response.text();
}

function parseAndTransformGames(csvText) {
  const records = parse(csvText, {
    skip_empty_lines: true
  });

  let leavingGamesData = [];

  // Starting loop at index 2 to skip headers
  for (let i = 2; i < records.length; i++) {
    const row = records[i];
    const rawGameName = row[COL_GAME_NAME]; // Column A
    const gameName = rawGameName ? rawGameName.trim() : "";
    
    if (gameName !== "") {
      const system = row[COL_SYSTEM] ? row[COL_SYSTEM].trim() : "N/A";     // Column B
      const tier = row[COL_TIER] ? row[COL_TIER].trim() : "N/A";       // Column C
      const rawLeaveDate = row[COL_LEAVE_DATE] ? row[COL_LEAVE_DATE].trim() : "TBD"; // Column F
      const metacritic = row[COL_METACRITIC] ? row[COL_METACRITIC].trim() : "N/A"; // Column J
      const rawCompletion = row[COL_COMPLETION] ? row[COL_COMPLETION].trim() : ""; // Column L

      const leaveDate = formatLeaveDate(rawLeaveDate);

      const completion = rawCompletion ? `${rawCompletion} hrs` : "Unknown";

      leavingGamesData.push({
        name: gameName,
        date: leaveDate,
        system: system,
        tier: tier,
        mc: metacritic,
        time: completion,
        timeNum: parseFloat(rawCompletion)
      });
    }
  }

  // Replicate sorting logic ascending based on raw hours
  leavingGamesData.sort(compareGamesByTime);

  return leavingGamesData;
}

function compareGamesByTime(a, b) {
  const timeA = a.timeNum;
  const timeB = b.timeNum;

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
}

async function postToDiscord(leavingGamesData) {
  const commonDate = leavingGamesData.length > 0 ? leavingGamesData[0].date : "TBD";
  let embedFields = [];
  
  for (let j = 0; j < leavingGamesData.length && j < 25; j++) {
    const game = leavingGamesData[j];

    const fieldName = truncateString(`**${escapeMarkdown(game.name)}**`, 256);
    const fieldValue = truncateString(`Platform: ${escapeMarkdown(game.system)} • Tier: ${escapeMarkdown(game.tier)}\nMetacritic: ${escapeMarkdown(game.mc)} • Completion: ${escapeMarkdown(game.time)}`, 1024);

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
      "description": `Here are the games leaving PS+ on **${escapeMarkdown(commonDate)}**.`,
      "color": ALERT_EMBED_COLOR,
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
    body: JSON.stringify(payload),
    redirect: "error"
  });

  if (discordResponse.ok) {
    console.log("Message successfully posted to Discord and memory state saved.");
  } else {
    console.error(`Failed to post. Discord returned code: ${discordResponse.status}`);
  }
  return discordResponse.ok;
}

async function runTracker() {
  validateWebhookUrl(process.env.DISCORD_WEBHOOK_URL);
  try {
    const csvText = await fetchCSV(CSV_URL);
    const leavingGamesData = parseAndTransformGames(csvText);

    if (leavingGamesData.length === 0) return;

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
      const success = await postToDiscord(leavingGamesData);
      if (success) {
        await fsp.writeFile('saved_list.json', currentListString);
      }
    } else {
      console.log("No new updates to the sheet. No message sent.");
    }
  } catch (err) {
    console.error("Fatal Operational Error:", err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runTracker();
} else {
  module.exports = {
    formatLeaveDate,
    fetchCSV,
    parseAndTransformGames,
    postToDiscord,
    runTracker,
    validateWebhookUrl
  };
}

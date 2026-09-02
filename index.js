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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    // Limit to 5MB max (5 * 1024 * 1024 = 5242880 bytes)
    if (contentLength && parseInt(contentLength, 10) > 5242880) {
      throw new Error(`Response too large: ${contentLength} bytes`);
    }

    return await response.text();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseAndTransformGames(csvText) {
  const records = parse(csvText, {
    skip_empty_lines: true
  });

  let leavingGamesData = [];
  const dateCache = new Map();

  // Starting loop at index 2 to skip headers
  for (let i = 2; i < records.length; i++) {
    const row = records[i];
    const rawGameName = row[COL_GAME_NAME]; // Column A
    const gameName = rawGameName ? rawGameName.trim() : "";
    
    if (gameName !== "" && gameName !== "#N/A") {
      const system = row[COL_SYSTEM] ? row[COL_SYSTEM].trim() : "N/A";     // Column B
      const tier = row[COL_TIER] ? row[COL_TIER].trim() : "N/A";       // Column C
      const rawLeaveDate = row[COL_LEAVE_DATE] ? row[COL_LEAVE_DATE].trim() : "TBD"; // Column F
      const metacritic = row[COL_METACRITIC] ? row[COL_METACRITIC].trim() : "N/A"; // Column J
      const rawCompletion = row[COL_COMPLETION] ? row[COL_COMPLETION].trim() : ""; // Column L

      let leaveDate = dateCache.get(rawLeaveDate);
      if (leaveDate === undefined) {
        leaveDate = formatLeaveDate(rawLeaveDate);
        dateCache.set(rawLeaveDate, leaveDate);
      }

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
  
  // Calculate base embed length to prevent exceeding Discord's 6000 character limit
  const title = "Games Leaving PS Plus Soon";
  const description = `Here are the games leaving PS+ on **${escapeMarkdown(commonDate)}**.`;
  const footerText = "Data parsed automatically from the Master List";

  let currentEmbedLength = title.length + description.length + footerText.length;

  for (let j = 0; j < leavingGamesData.length && j < 25; j++) {
    const game = leavingGamesData[j];

    const fieldName = truncateString(`**${escapeMarkdown(game.name)}**`, 256);
    const fieldValue = truncateString(`Platform: ${escapeMarkdown(game.system)} • Tier: ${escapeMarkdown(game.tier)}\nMetacritic: ${escapeMarkdown(game.mc)} • Completion: ${escapeMarkdown(game.time)}`, 1024);

    const fieldLength = fieldName.length + fieldValue.length;
    if (currentEmbedLength + fieldLength > 6000) {
      break;
    }

    currentEmbedLength += fieldLength;

    embedFields.push({
      "name": fieldName,
      "value": fieldValue,
      "inline": false
    });
  }

  const payload = {
    "content": "@everyone 🚨 **PS Plus Games Leaving Update!**",
    "embeds": [{
      "title": title,
      "url": "https://docs.google.com/spreadsheets/d/19RorxFhWc2lHocg4c9zrVssSwZq1u2nPcpTsAvzdJQw/edit#gid=353702390",
      "description": description,
      "color": ALERT_EMBED_COLOR,
      "fields": embedFields,
      "footer": {
        "text": footerText
      },
      "timestamp": new Date().toISOString()
    }]
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let discordResponse;
  try {
    discordResponse = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "error",
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error("Failed to post. Discord request timed out.");
      return false;
    }
    console.error(`Failed to post. Error: ${error.message}`);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }

  if (discordResponse.ok) {
    console.log("Message successfully posted to Discord and memory state saved.");
  } else {
    console.error(`Failed to post. Discord returned code: ${discordResponse.status}`);
  }
  return discordResponse.ok;
}

async function readSavedState() {
  try {
    return await fsp.readFile('saved_list.json', 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
    return "";
  }
}

async function writeSavedState(data) {
  await fsp.writeFile('saved_list.json', data);
}

async function processUpdates(leavingGamesData) {
  if (leavingGamesData.length === 0) return;

  const currentListString = JSON.stringify(leavingGamesData);
  const savedListString = await readSavedState();

  if (TEST_MODE || savedListString !== currentListString) {
    const success = await postToDiscord(leavingGamesData);
    if (success) {
      await writeSavedState(currentListString);
    }
  } else {
    console.log("No new updates to the sheet. No message sent.");
  }
}

async function runTracker() {
  validateWebhookUrl(process.env.DISCORD_WEBHOOK_URL);
  try {
    const csvText = await fetchCSV(CSV_URL);
    const leavingGamesData = parseAndTransformGames(csvText);
    await processUpdates(leavingGamesData);
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
    validateWebhookUrl,
    readSavedState,
    writeSavedState,
    processUpdates
  };
}

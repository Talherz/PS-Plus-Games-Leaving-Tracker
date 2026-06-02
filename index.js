// index.js
const { parse } = require("csv-parse/sync");
const hltb = require("howlongtobeat");
const hltbService = new hltb.HowLongToBeatService();

// Configuration
const TEST_MODE = false; // Set to false so it doesn't spam during automation
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1511388561188847841/0KXQNm6MFZ7eTqZpvo5GgRfnKho0-uPlSzfbcLtgi0IAXdNlhbFjfh7OMB9vL3rYLKKW";
const CSV_URL = "https://docs.google.com/spreadsheets/d/19RorxFhWc2lHocg4c9zrVssSwZq1u2nPcpTsAvzdJQw/export?format=csv&gid=353702390";

async function runTracker() {
  try {
    const response = await fetch(CSV_URL);
    const csvText = await response.text();
    
    const records = parse(csvText, {
      skip_empty_lines: true
    });

    let leavingGamesData = [];
    
    for (let i = 2; i < records.length; i++) {
      const row = records[i];
      const gameName = row[0];
      
      if (gameName && gameName.trim() !== "") {
        const system = row[1] ? row[1].trim() : "N/A";
        const tier = row[2] ? row[2].trim() : "N/A";
        const leaveDate = row[5] ? row[5].trim() : "TBD";
        const metacritic = row[9] ? row[9].trim() : "N/A";

        // Step 1: Format the Date String
        let formattedDate = "Unknown Date";
        if (leaveDate !== "TBD") {
          const d = new Date(leaveDate);
          if (!isNaN(d.getTime())) {
            formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          } else {
            formattedDate = leaveDate;
          }
        }

        // Step 2: Force Completionist Data
        let completion = "Not found on HLTB";
        try {
          const hltbResults = await hltbService.search(gameName);
          if (hltbResults && hltbResults.length > 0) {
            const compTime = hltbResults[0].gameplayCompletionist;
            completion = compTime ? `${compTime} hrs` : "No completionist data";
          }
        } catch (error) {
          console.error(`HLTB API Blocked for ${gameName}`);
          completion = "API Blocked";
        }

        leavingGamesData.push({
          name: gameName.trim(),
          date: formattedDate,
          system: system,
          tier: tier,
          mc: metacritic,
          time: completion
        });

        // Anti-bot throttle
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
    }

    if (leavingGamesData.length === 0) return;

    const fs = require('fs');
    let savedListString = "";
    if (fs.existsSync('saved_list.json')) {
      savedListString = fs.readFileSync('saved_list.json', 'utf8');
    }

    const currentListString = JSON.stringify(leavingGamesData);

    if (TEST_MODE || savedListString !== currentListString) {
      
      let embedFields = [];
      for (let j = 0; j < leavingGamesData.length && j < 25; j++) {
        const game = leavingGamesData[j];
        embedFields.push({
          "name": "🎮 **" + game.name + "**",
          "value": "• **Platform:** " + game.system + "\n• **Tier:** " + game.tier + "\n• **Metacritic:** " + game.mc + " • **Completionist:** " + game.time,
          "inline": false
        });
      }

      const headerDate = leavingGamesData.length > 0 ? leavingGamesData[0].date : "Upcoming";

      const payload = {
        "content": "@everyone 🚨 **PS Plus Catalog Update!**\nHere are the games leaving PS+ on **" + headerDate + "**.",
        "embeds": [{
          "title": "Games Leaving PS Plus Soon",
          "color": 16753920,
          "fields": embedFields,
          "footer": {
            "text": "HLTB Completionist Times • Data parsed from the Master List"
          },
          "timestamp": new Date().toISOString()
        }]
      };

      const discordResponse = await fetch(DISCORD_WEBHOOK_URL, {
        method: "post",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (discordResponse.ok) {
        fs.writeFileSync('saved_list.json', currentListString);
        console.log("Successfully posted to Discord and saved memory state.");
      } else {
        console.error(`Discord Error: ${discordResponse.status}`);
      }
    } else {
      console.log("No new updates to the sheet. No message sent.");
    }
  } catch (err) {
    console.error("Fatal Error:", err);
    process.exit(1);
  }
}

runTracker();

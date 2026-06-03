// index.js
const { parse } = require("csv-parse/sync");
const fs = require("fs");

// SET THIS TO true FOR TESTING, THEN BACK TO false WHEN YOU ARE DONE
const TEST_MODE = true;

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
    
    // Starting loop at index 2 to skip headers[cite: 2]
    for (let i = 2; i < records.length; i++) {
      const row = records[i];
      const gameName = row[0]; // Column A[cite: 2]
      
      if (gameName && gameName.trim() !== "") {
        const system = row[1] ? row[1].trim() : "N/A";     // Column B[cite: 2]
        const tier = row[2] ? row[2].trim() : "N/A";       // Column C[cite: 2]
        const rawLeaveDate = row[5] ? row[5].trim() : "TBD"; // Column F[cite: 2]
        const metacritic = row[9] ? row[9].trim() : "N/A"; // Column J[cite: 2]
        const rawCompletion = row[11] ? row[11].trim() : ""; // Column L[cite: 2]

        // Format Date String to match 'MMM dd, yyyy'[cite: 2]
        let leaveDate = "TBD";
        if (rawLeaveDate && rawLeaveDate !== "TBD") {
          const d = new Date(rawLeaveDate);
          if (!isNaN(d.getTime())) {
            leaveDate = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
          } else {
            leaveDate = rawLeaveDate;
          }
        }
        
        const completion = rawCompletion ? `${rawCompletion} hrs` : "Unknown";[cite: 2]

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

    // Replicate sorting logic ascending based on raw hours[cite: 2]
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
    
    // Check local file state instead of Google PropertiesService[cite: 2]
    if (fs.existsSync('saved_list.json')) {
      savedListString = fs.readFileSync('saved_list.json', 'utf8');
    }
    
    if (TEST_MODE || savedListString !== currentListString) {
      
      const commonDate = leavingGamesData.length > 0 ? leavingGamesData[0].date : "TBD";[cite: 2]
      let embedFields = [];
      
      for (let j = 0; j < leavingGamesData.length && j < 25; j++) {
        const game = leavingGamesData[j];
        embedFields.push({
          "name": "**" + game.name + "**",[cite: 2]
          "value": "Platform: " + game.system + " • Tier: " + game.tier + "\nMetacritic: " + game.mc + " • Completion: " + game.time,[cite: 2]
          "inline": false
        });
      }

      const payload = {
        "content": "@everyone 🚨 **PS Plus Games Leaving Update!**",[cite: 2]
        "embeds": [{
          "title": "Games Leaving PS Plus Soon",[cite: 2]
          "url": "https://docs.google.com/spreadsheets/d/19RorxFhWc2lHocg4c9zrVssSwZq1u2nPcpTsAvzdJQw/edit#gid=353702390",[cite: 2]
          "description": "Here are the games leaving PS+ on **" + commonDate + "**.",[cite: 2]
          "color": 16753920,[cite: 2]
          "fields": embedFields,[cite: 2]
          "footer": {
            "text": "Data parsed automatically from the Master List"[cite: 2]
          },
          "timestamp": new Date().toISOString()[cite: 2]
        }]
      };

      const discordResponse = await fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (discordResponse.ok) {
        fs.writeFileSync('saved_list.json', currentListString);
        console.log("Message successfully posted to Discord and memory state saved.");
      } else {
        console.error(`Failed to post. Discord returned code: ${discordResponse.status}`);
      }
    } else {
      console.log("No new updates to the sheet. No message sent.");[cite: 2]
    }
  } catch (err) {
    console.error("Fatal Operational Error:", err);
    process.exit(1);
  }
}

runTracker();

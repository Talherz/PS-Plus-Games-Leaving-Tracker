const { HowLongToBeatService } = require('howlongtobeat');
const { parse } = require('csv-parse/sync');
const fs = require('fs'); 

// Configuration
const TEST_MODE = false; // Set to false so it doesn't spam during automation
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1511388561188847841/0KXQNm6MFZ7eTqZpvo5GgRfnKho0-uPlSzfbcLtgi0IAXdNlhbFjfh7OMB9vL3rYLKKW";

// Google Sheets public CSV export link for the "Leaving Soon" tab
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/19RorxFhWc2lHocg4c9zrVssSwZq1u2nPcpTsAvzdJQw/export?format=csv&gid=353702390";

// Initialize the HowLongToBeat API Wrapper
const hltbService = new HowLongToBeatService();

async function trackAndPostLeavingGames() {
    console.log("Fetching Master List from Google Sheets...");
    
    let csvData;
    try {
        const response = await fetch(SHEET_CSV_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        csvData = await response.text();
    } catch (error) {
        console.error("Failed to fetch the Google Sheet:", error);
        return;
    }

    const rows = parse(csvData, { skip_empty_lines: true });
    const leavingGamesData = [];
    
    const gameNameIdx = 0;   
    const systemIdx = 1;     
    const tierIdx = 2;       
    const leaveDateIdx = 5;  
    const metacriticIdx = 9; 
    const completionIdx = 11; 

    console.log("Processing games and querying HowLongToBeat API...");

    for (let i = 2; i < rows.length; i++) {
        const gameName = rows[i][gameNameIdx]?.trim();
        
        if (gameName) {
            const leaveDate = rows[i][leaveDateIdx] || "TBD";
            const system = rows[i][systemIdx] || "N/A";
            const tier = rows[i][tierIdx] || "N/A";
            const metacritic = rows[i][metacriticIdx] || "N/A";
            const sheetCompletion = rows[i][completionIdx];
            
            let hltbTime = "Unknown";
            let rawTime = 9999; 

            // 1. QUERY THE HOWLONGTOBEAT API
            try {
                // We split at " - " to remove long subtitles (e.g., "Scott Pilgrim - Complete Edition") 
                // because the HLTB search engine frequently chokes on them.
                const searchName = gameName.split(' - ')[0];
                console.log(`Searching API for: ${searchName}`);
                
                const hltbResults = await hltbService.search(searchName);
                
                if (hltbResults && hltbResults.length > 0) {
                    const topResult = hltbResults[0];
                    
                    if (topResult.gameplayCompletionist) {
                        hltbTime = `${topResult.gameplayCompletionist} hrs`;
                        rawTime = topResult.gameplayCompletionist;
                    } else if (topResult.gameplayMainExtra) {
                        // Fallback to Main + Extras if 100% time isn't logged
                        hltbTime = `${topResult.gameplayMainExtra} hrs`;
                        rawTime = topResult.gameplayMainExtra;
                    }
                }
            } catch (apiError) {
                console.error(`HLTB API failed for ${gameName}:`, apiError.message);
            }

            // 2. THE SAFETY NET
            // If the API returns nothing (or Cloudflare blocks it), fall back to the sheet's data
            if (hltbTime === "Unknown" && sheetCompletion && sheetCompletion.trim() !== "") {
                hltbTime = `${sheetCompletion} hrs (Sheet)`; // Tagged so you know it was a fallback
                rawTime = parseFloat(sheetCompletion) || 9999;
            }

            leavingGamesData.push({
                name: gameName,
                date: leaveDate,
                system: system,
                tier: tier,
                mc: metacritic,
                time: hltbTime,
                timeRaw: rawTime
            });

            // 3. THE ANTI-BOT THROTTLE
            // Wait 2.5 seconds before querying the next game to prevent Cloudflare bans
            await new Promise(resolve => setTimeout(resolve, 2500));
        }
    }

    if (leavingGamesData.length === 0) return;

    // Sort games by completion time
    leavingGamesData.sort((a, b) => a.timeRaw - b.timeRaw);

    const currentListString = JSON.stringify(leavingGamesData);
    const memoryPath = './saved_list.json';
    let savedListString = "";

    if (fs.existsSync(memoryPath)) {
        savedListString = fs.readFileSync(memoryPath, 'utf8');
    }

    if (TEST_MODE || savedListString !== currentListString) {
        const commonDate = leavingGamesData[0].date !== "TBD" ? leavingGamesData[0].date : "an upcoming date";
        const embedFields = [];

        for (let j = 0; j < leavingGamesData.length && j < 25; j++) {
            const game = leavingGamesData[j];
            
            embedFields.push({
                name: `🎮 **${game.name}**`,
                // Formatted so Metacritic and Completion share the same line
                value: `• **Platform:** ${game.system}\n• **Tier:** ${game.tier}\n• **Metacritic:** ${game.mc} • **Completion:** ${game.time}`,
                inline: false
            });
        }

        const payload = {
            content: `@everyone 🚨 **PS Plus Catalog Update!**\nHere are the games leaving PS+ on **${commonDate}**.`,
            embeds: [{
                title: "Games Leaving PS Plus Soon",
                url: "https://docs.google.com/spreadsheets/d/19RorxFhWc2lHocg4c9zrVssSwZq1u2nPcpTsAvzdJQw/edit#gid=353702390",
                color: 16753920,
                fields: embedFields,
                footer: {
                    text: "HLTB Completionist Times • Data fetched via API & Master List"
                },
                timestamp: new Date().toISOString()
            }]
        };

        try {
            const response = await fetch(DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                console.error(`Discord Error: ${response.status}`);
            } else {
                console.log("Message successfully posted to Discord.");
                fs.writeFileSync(memoryPath, currentListString, 'utf8');
            }
        } catch (discordErr) {
            console.error("Failed to reach Discord:", discordErr);
        }
    } else {
        console.log("No changes detected. Skipping Discord post.");
    }
}

trackAndPostLeavingGames();

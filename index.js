const { HowLongToBeatService } = require('howlongtobeat');
const { parse } = require('csv-parse/sync');
const fs = require('fs'); 

// Configuration
const TEST_MODE = false; // Set to false so it doesn't spam during automation
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1511388561188847841/0KXQNm6MFZ7eTqZpvo5GgRfnKho0-uPlSzfbcLtgi0IAXdNlhbFjfh7OMB9vL3rYLKKW";

// Google Sheets public CSV export link for the "Leaving Soon" tab (gid=353702390)
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/19RorxFhWc2lHocg4c9zrVssSwZq1u2nPcpTsAvzdJQw/export?format=csv&gid=353702390";

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

    // Parse the CSV into an array of arrays
    const rows = parse(csvData, {
        skip_empty_lines: true
    });

    const leavingGamesData = [];
    
    // Map column indexes based on the spreadsheet architecture
    const gameNameIdx = 0;   
    const systemIdx = 1;     
    const tierIdx = 2;       
    const leaveDateIdx = 5;  
    const metacriticIdx = 9; 

    console.log("Querying HowLongToBeat for completionist times...");

    // Start at row 2 to skip the Title and Headers
    for (let i = 2; i < rows.length; i++) {
        const gameName = rows[i][gameNameIdx]?.trim();
        
        if (gameName) {
            const leaveDate = rows[i][leaveDateIdx] || "TBD";
            const system = rows[i][systemIdx] || "N/A";
            const tier = rows[i][tierIdx] || "N/A";
            const metacritic = rows[i][metacriticIdx] || "N/A";
            
            let hltbTime = "Unknown";
            let rawTime = 9999; // Default high sorting value for unknown times

            try {
                // Search HLTB for the game
                const hltbResults = await hltbService.search(gameName);
                
                // If results are found, take the first one (most relevant)
                if (hltbResults && hltbResults.length > 0) {
                    const bestMatch = hltbResults[0];
                    // You can change 'gameplayCompletionist' to 'gameplayMainExtra' if you prefer
                    const completionistHours = bestMatch.gameplayCompletionist; 
                    
                    if (completionistHours > 0) {
                        hltbTime = `${completionistHours} hrs`;
                        rawTime = completionistHours;
                    }
                }
            } catch (err) {
                console.log(`HLTB Search failed for ${gameName}`);
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
        }
    }

    if (leavingGamesData.length === 0) {
        console.log("No leaving games found.");
        return;
    }

    // Sort games by our raw HLTB time (ascending)
    leavingGamesData.sort((a, b) => a.timeRaw - b.timeRaw);

    const currentListString = JSON.stringify(leavingGamesData);
    const memoryPath = './saved_list.json';
    let savedListString = "";

    // If the memory file exists, read it
    if (fs.existsSync(memoryPath)) {
        savedListString = fs.readFileSync(memoryPath, 'utf8');
    }

    // Only proceed if testing is forced OR the list of games has changed
    if (TEST_MODE || savedListString !== currentListString) {
        const commonDate = leavingGamesData[0].date !== "TBD" ? leavingGamesData[0].date : "an upcoming date";
        const embedFields = [];

        for (let j = 0; j < leavingGamesData.length && j < 25; j++) {
            const game = leavingGamesData[j];
            
            embedFields.push({
                name: `🎮 **${game.name}**`,
                value: `• **Platform:** ${game.system}\n• **Tier:** ${game.tier}\n• **Metacritic:** ${game.mc}\n• **Completion:** ${game.time}`,
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
                    text: "HLTB Completionist Times • Data parsed from the Master List"
                },
                timestamp: new Date().toISOString()
            }]
        };

        console.log("Sending payload to Discord...");
        
        try {
            const response = await fetch(DISCORD_WEBHOOK_URL, {
            console.error(`Discord Error: ${response.status}`);
        }
    } catch (discordErr) {
        console.error("Failed to reach Discord:", discordErr);
    }
}

trackAndPostLeavingGames();

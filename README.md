# 🎮 PS Plus Departure Tracker

An automated, serverless Node.js bot that monitors the PlayStation Plus catalog for games leaving the service, retrieves their completionist hours, and pushes perfectly formatted alerts directly to a Discord server.

Built entirely on **GitHub Actions**, this script runs on a scheduled cron job, ensuring zero server costs and zero maintenance. It reads data dynamically from the community-driven [PS Plus Master List](https://docs.google.com/spreadsheets/d/19RorxFhWc2lHocg4c9zrVssSwZq1u2nPcpTsAvzdJQw/edit#gid=353702390) to completely avoid API rate limits and web scraping bans.

## ✨ Features
* **Serverless Automation:** Runs reliably in the background via GitHub Actions.
* **Discord Webhook Integration:** Delivers clean, easily scannable embedded messages.
* **Smart Memory State:** Uses a localized `saved_list.json` to remember previous runs, ensuring your Discord server is only pinged when new games are added to the departure list.
* **Time-to-Beat Sorting:** Automatically sorts games by raw completion hours so players can prioritize their backlog.
* **Date Formatting Engine:** Intercepts raw spreadsheet strings and standardizes them into readable departure dates.

## 🚀 How to Use This for Your Own Server

You can easily fork this project and set it up for your own Discord community in less than 5 minutes.

### Prerequisites
* A Discord server where you have permission to create Webhooks.
* A free GitHub account.

### Setup Instructions

1.  **Fork the Repository:** Click the "Fork" button at the top right of this page to copy this project to your own GitHub account.
2.  **Create a Discord Webhook:**
    * Go to your Discord Server Settings > Integrations > Webhooks.
    * Click **New Webhook**, name it, choose the channel for alerts, and click **Copy Webhook URL**.
3.  **Update the Script:**
    * In your forked repository, open `index.js`.
    * Replace `"YOUR_DISCORD_WEBHOOK_URL_HERE"` (around line 7) with the URL you just copied. 
    * Commit the change.
4.  **Activate GitHub Actions:**
    * Go to the **Actions** tab in your repository.
    * Click "I understand my workflows, go ahead and enable them."
    * Select **PS Plus Tracker Automation** on the left menu, click the **Run workflow** dropdown on the right, and manually trigger the first run!

*Note: The script is currently set to check for updates at the top of every hour. You can change this frequency by editing the cron schedule in `.github/workflows/schedule.yml`.*

## 🛠️ Built With
* **Node.js 24** - Runtime environment
* **csv-parse** - Data extraction tool
* **GitHub Actions** - CI/CD pipeline and task scheduler

## 🤝 Contributing

Contributions, issues, and feature requests are always welcome! If you have ideas on how to improve the code, optimize the sorting logic, or expand the embed formatting:
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

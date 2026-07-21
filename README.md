# 🎮 PS Plus Games Leaving Tracker

A simple automated tool that watches the PlayStation Plus catalog to see when games are leaving the service. It finds out how long each game takes to beat and sends clean, easy-to-read alerts straight to your Discord server.

This tool runs completely in the background using **GitHub Actions**, meaning it's free and requires no maintenance. It gathers its data from the community-driven [PS Plus Master List](https://docs.google.com/spreadsheets/d/19RorxFhWc2lHocg4c9zrVssSwZq1u2nPcpTsAvzdJQw/edit#gid=353702390) so it's always up to date.

## ✨ Features
* **Fully Automated:** Runs by itself in the background. You set it up once and forget it.
* **Private and Secure:** Your Discord server details are kept completely private.
* **Discord Alerts:** Sends neat, formatted messages directly to your server.
* **Smart Notifications:** It remembers what it has already posted, so you only get pinged when *new* games are announced as leaving.
* **Time-to-Beat Sorting:** Automatically sorts leaving games by how many hours they take to beat, helping players prioritize their backlog.
* **Easy Testing:** Includes tools to safely test the bot without sending fake messages to your Discord server.

## 🚀 How to Use This for Your Own Server

You can easily copy this project and set it up for your own Discord community in less than 5 minutes. Your server details will remain totally private.

### What You Need
* A Discord server where you have permission to create Webhooks (a way to receive automated messages).
* A free GitHub account.

### Setup Instructions

1.  **Copy the Project:** Click the "Fork" button at the top right of this page to create your own copy of this project on your GitHub account.
2.  **Create a Discord Webhook:**
    * Go to your Discord Server Settings > Integrations > Webhooks.
    * Click **New Webhook**, give it a name, choose the channel where you want the alerts to go, and click **Copy Webhook URL**.
3.  **Keep Your URL Secret:**
    * In your new GitHub project, click the **Settings** tab.
    * On the left menu, scroll down to **Secrets and variables** and click **Actions**.
    * Click the green **New repository secret** button.
    * **Name:** Type exactly `DISCORD_WEBHOOK_URL`
    * **Secret:** Paste the webhook URL you just copied from Discord.
    * Click **Add secret**.
4.  **Turn It On:**
    * Go to the **Actions** tab in your repository.
    * Click "I understand my workflows, go ahead and enable them."
    * Select **PS Plus Tracker Automation** on the left menu, click the **Run workflow** dropdown on the right, and manually run it for the first time!

*Note: The bot is currently set to check for new games leaving at the top of every hour. You can change how often it checks in the `.github/workflows/schedule.yml` file.*

## 💻 For Developers

If you want to run the code on your own computer, test it, or help improve it, follow these steps:

### Installation
Make sure you have [Node.js 24+](https://nodejs.org/) installed, then download the required files:
```bash
npm install
```

### Running Locally
To test the code on your computer and send a real message to your Discord:
```bash
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/your-webhook-id" npm start
```

### Test Mode
If you want to test the code without sending a real message to Discord:
1. Open `index.js`.
2. Change `const TEST_MODE = false;` to `const TEST_MODE = true;`.
3. Run `npm start`.

*Don't forget to change `TEST_MODE` back to `false` before saving your changes to GitHub!*

### Running Tests
To run the automated tests to make sure everything is working correctly:
```bash
npm test
```

## 🛠️ Built With
* **Node.js 24** - The programming language it's built in
* **csv-parse** - Used to read the spreadsheet data
* **GitHub Actions** - Runs the automation in the background

## 🤝 Contributing

Contributions, suggestions, and feedback are always welcome! If you have ideas on how to make this better:
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

Distributed under the MIT License. See the `LICENSE` file for more information.

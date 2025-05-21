require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');
const express = require('express');
const app = express();

// Initialize bot with token from environment variable
const bot = new Telegraf(process.env.BOT_TOKEN);
const SECRET_PATH = `/webhook/${process.env.BOT_TOKEN}`;

// Add error handling
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}`, err);
});

// Your existing bot command
bot.command('uid', async (ctx) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

  const generateRandomName = () => {
    const length = Math.floor(Math.random() * 11) + 10; // 10 to 20
    let name = '';
    for (let i = 0; i < length; i++) {
      name += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return name;
  };

  const input = ctx.message.text.split(' ')[1];
  const count = Math.min(parseInt(input) || 1, 20); // Max 20

  await ctx.reply(`Generating ${count} UID(s)...`);

  for (let i = 0; i < count; i++) {
    const randomName = generateRandomName();
    const url = `https://ff-account-register.vercel.app/genuidpw/?prefix=${randomName}`;

    try {
      const res = await axios.get(url);
      const info = res.data.guest_account_info;

      if (info) {
        await ctx.reply(`UID ${i + 1}: ${JSON.stringify(info)}`);
      } else {
        await ctx.reply(`UID ${i + 1}: guest_account_info missing.`);
      }
    } catch (err) {
      await ctx.reply(`UID ${i + 1}: API call failed.`);
    }
  }
});

// Set up webhooks
app.use(express.json());

// Webhook handler for telegram
app.post(SECRET_PATH, (req, res) => {
  bot.handleUpdate(req.body, res);
});

// For health checks
app.get('/', (req, res) => {
  res.send('Bot is running!');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export for Vercel
module.exports = app;
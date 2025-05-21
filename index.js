require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');
const express = require('express');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const os = require('os');
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

  // Create temporary directory for files
  const tmpDir = path.join(os.tmpdir(), 'bot-' + Date.now());
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
  } catch (err) {
    console.error('Error creating temp directory:', err);
    await ctx.reply('Error creating temporary files');
    return;
  }

  // Path for zip file
  const zipPath = path.join(tmpDir, 'accounts.zip');
  const zip = new AdmZip();
  
  // Generate accounts
  for (let i = 0; i < count; i++) {
    const randomName = generateRandomName();
    const url = `https://ff-account-register.vercel.app/genuidpw/?prefix=${randomName}`;

    try {
      const res = await axios.get(url);
      const info = res.data;

      if (info && info.guest_account_info) {
        // Add file to zip
        const textOutput = JSON.stringify(info);
        
        // Create folder structure in zip
        zip.addFile(`${i + 1}/guest100067.dat`, Buffer.from(textOutput));
      } else {
        await ctx.reply(`UID ${i + 1}: guest_account_info missing.`);
      }
    } catch (err) {
      console.error('API error:', err);
      await ctx.reply(`UID ${i + 1}: API call failed.`);
    }
  }

  // Write the zip and send it
  try {
    zip.writeZip(zipPath);
    await ctx.replyWithDocument({ source: zipPath });
    
    // Clean up temp files (after a delay to ensure sending completes)
    setTimeout(() => {
      try {
        fs.unlinkSync(zipPath);
        fs.rmdirSync(tmpDir, { recursive: true });
      } catch (err) {
        console.error('Error cleaning up temp files:', err);
      }
    }, 10000);
  } catch (err) {
    console.error('Error creating zip:', err);
    await ctx.reply('Error creating accounts zip file');
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
require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
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

// Welcome message and help command
bot.start(async (ctx) => {
  const userName = ctx.message.from.first_name;
  
  const welcomeMessage = `
🎮 *Welcome to FF UID Generator Bot* 🎮

Hello ${userName}! 👋 I'm your personal FreeFire UID generator bot!

*How to use this bot:* 

📱 Send */uid* to generate 1 account
📱 Send */uid 5* to generate multiple accounts (max 20)

*Features:*
✅ Fast generation
✅ Easy to use
✅ ZIP file format
✅ No login required
✅ 100% Free

*Example:*
Type */uid 3* to get 3 FreeFire guest accounts

*Need help?*
Send */help* for more information

🔥 *Enjoy gaming!* 🔥
`;

  // Create an inline keyboard with a button
  const keyboard = Markup.inlineKeyboard([
    Markup.button.callback('📱 Generate UID', 'generate_uid')
  ]);

  await ctx.replyWithMarkdown(welcomeMessage, keyboard);
});

// Handle the inline button click
bot.action('generate_uid', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('🎮 Type /uid followed by a number to generate UIDs\nExample: /uid 5');
});

// Help command
bot.command('help', async (ctx) => {
  const helpMessage = `
📋 *FF UID Generator Bot Help* 📋

*Available Commands:*
*/start* - Welcome message and bot info
*/uid* - Generate 1 account
*/uid X* - Generate X accounts (1-20)
*/help* - Show this help message

*How to use generated accounts:*
1️⃣ Download the ZIP file
2️⃣ Extract it to get the account data
3️⃣ Use the guest account info to log in

*Note:* 
⚠️ Generated accounts are temporary guest accounts
⚠️ Maximum 20 accounts per request

If you have any issues, try again later!
`;

  await ctx.replyWithMarkdown(helpMessage);
});

// Your existing bot command - updated to use a single status message
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

  // Send a single status message that we'll update
  const statusMsg = await ctx.reply(`⏳ *Generating ${count} UID(s)...*\n\n_Please wait while I process your request_`);

  // Create temporary directory for files
  const tmpDir = path.join(os.tmpdir(), 'bot-' + Date.now());
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
  } catch (err) {
    console.error('Error creating temp directory:', err);
    await ctx.telegram.editMessageText(
      statusMsg.chat.id, 
      statusMsg.message_id, 
      undefined, 
      '❌ Error creating temporary files'
    );
    return;
  }

  // Path for zip file
  const zipPath = path.join(tmpDir, 'accounts.zip');
  const zip = new AdmZip();
  
  // Generate accounts
  for (let i = 0; i < count; i++) {
    // Update status message with progress
    if (count > 1) {
      await ctx.telegram.editMessageText(
        statusMsg.chat.id, 
        statusMsg.message_id, 
        undefined, 
        `⏳ *Generating UID ${i+1}/${count}...*\n\n_Please wait while I process your request_`
      );
    }
    
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
        await ctx.telegram.editMessageText(
          statusMsg.chat.id, 
          statusMsg.message_id, 
          undefined, 
          `❌ UID ${i + 1}: guest_account_info missing.`
        );
      }
    } catch (err) {
      console.error('API error:', err);
      await ctx.telegram.editMessageText(
        statusMsg.chat.id, 
        statusMsg.message_id, 
        undefined, 
        `❌ UID ${i + 1}: API call failed.`
      );
    }
  }

  // Write the zip and send it
  try {
    zip.writeZip(zipPath);
    
    // Final status update
    await ctx.telegram.editMessageText(
      statusMsg.chat.id, 
      statusMsg.message_id, 
      undefined, 
      `✅ *${count} UID(s) Successfully Generated*\n\n_Sending ZIP file..._`
    );
    
    await ctx.replyWithDocument({ source: zipPath });
    
    // After sending the file, delete the status message to keep chat clean
    setTimeout(() => {
      try {
        ctx.telegram.deleteMessage(statusMsg.chat.id, statusMsg.message_id)
          .catch(err => console.error('Could not delete message:', err));
      } catch (err) {
        console.error('Error deleting message:', err);
      }
    }, 3000);
    
    // Clean up temp files
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
    await ctx.telegram.editMessageText(
      statusMsg.chat.id, 
      statusMsg.message_id, 
      undefined, 
      '❌ Error creating accounts zip file'
    );
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
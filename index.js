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

📱 Send */uid [number] [name]* to generate accounts
📱 Example: */uid 5 myname* - Generate 5 accounts with name "myname"

*Features:*
✅ Custom name support
✅ Auto name padding (minimum 10 characters)
✅ Fast generation
✅ ZIP file format
✅ No login required
✅ 100% Free

*Example Commands:*
*/uid 3 john* - Generate 3 accounts with name starting "john"
*/uid 1 player123* - Generate 1 account with name "player123"

*Note:* If your name is less than 10 characters, bot will automatically add random characters to make it 10+ characters.

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
  await ctx.reply('🎮 Type /uid [number] [name] to generate UIDs\nExample: /uid 5 myname');
});

// Help command
bot.command('help', async (ctx) => {
  const helpMessage = `
📋 *FF UID Generator Bot Help* 📋

*Available Commands:*
*/start* - Welcome message and bot info
*/uid [number] [name]* - Generate accounts with custom name
*/help* - Show this help message

*Command Format:*
*/uid [number] [name]*
• [number] = How many accounts (1-20)
• [name] = Your desired name prefix

*Examples:*
*/uid 1 john* - Generate 1 account with name "john"
*/uid 5 player* - Generate 5 accounts with name "player"
*/uid 10 myname123* - Generate 10 accounts with name "myname123"

*Name Rules:*
• If name is less than 10 characters, bot adds random characters
• If name is 10+ characters, bot uses it as-is
• Only use letters and numbers in names

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

// Global counter for sequential ZIP naming (in production, use database)
let zipCounter = 1;

// Updated UID command with custom name support
bot.command('uid', async (ctx) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

  const generateNameWithPadding = (baseName) => {
    // Remove any non-alphanumeric characters and convert to lowercase
    const cleanName = baseName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (cleanName.length >= 10) {
      return cleanName;
    }
    
    // Add random characters to make it at least 10 characters
    const remainingLength = 10 - cleanName.length;
    let padding = '';
    for (let i = 0; i < remainingLength; i++) {
      padding += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return cleanName + padding;
  };

  const commandParts = ctx.message.text.split(' ');
  
  // Check if command format is correct
  if (commandParts.length < 3) {
    await ctx.reply(`
❌ *Wrong Format!*

*Correct format:* /uid [number] [name]

*Examples:*
/uid 1 john
/uid 5 player
/uid 10 myname

Please try again with the correct format.
    `, { parse_mode: 'Markdown' });
    return;
  }

  const countInput = commandParts[1];
  const nameInput = commandParts.slice(2).join(''); // Join remaining parts as name
  
  // Validate count
  const count = parseInt(countInput);
  if (isNaN(count) || count < 1 || count > 20) {
    await ctx.reply(`
❌ *Invalid Number!*

Please enter a number between 1 and 20.

*Example:* /uid 5 myname
    `, { parse_mode: 'Markdown' });
    return;
  }

  // Validate name
  if (!nameInput || nameInput.trim() === '') {
    await ctx.reply(`
❌ *Name Required!*

Please provide a name for your accounts.

*Example:* /uid 5 myname
    `, { parse_mode: 'Markdown' });
    return;
  }

  // Generate the final name with padding if needed
  const finalName = generateNameWithPadding(nameInput.trim());
  
  // Send a single status message that we'll update
  const statusMsg = await ctx.reply(`⏳ *Generating ${count} UID(s) with name "${finalName}"...*\n\n_Please wait while I process your request_`, { parse_mode: 'Markdown' });

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

  // Path for zip file with sequential naming
  const zipFileName = `accounts(${zipCounter}).zip`;
  const zipPath = path.join(tmpDir, zipFileName);
  const zip = new AdmZip();
  
  // Array to store UID and password data for ID.json
  const accountsData = [];
  
  // Generate accounts
  for (let i = 0; i < count; i++) {
    // Update status message with progress
    if (count > 1) {
      await ctx.telegram.editMessageText(
        statusMsg.chat.id, 
        statusMsg.message_id, 
        undefined, 
        `🎮 *Generating UID ${i+1}/${count} with name "${finalName}"...*\n\n_Please wait ⏳ while I process your request_`,
        { parse_mode: 'Markdown' }
      );
    }
    
    const url = `https://ff-account-register.vercel.app/genuidpw/?prefix=${finalName}`;

    try {
      const res = await axios.get(url);
      const info = res.data;

      if (info && info.guest_account_info) {
        // Add file to zip
        const textOutput = JSON.stringify(info);
        
        // Create folder structure in zip
        zip.addFile(`${i + 1}/guest100067.dat`, Buffer.from(textOutput));
        
        // Extract UID and password for ID.json
        if (info.guest_account_info.guest_id && info.guest_account_info.guest_password) {
          accountsData.push({
            uid: info.guest_account_info.guest_id,
            password: info.guest_account_info.guest_password
          });
        }
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
    // Add ID.json file to zip with all account data
    if (accountsData.length > 0) {
      const idJsonContent = JSON.stringify(accountsData, null, 2);
      zip.addFile('ID.json', Buffer.from(idJsonContent));
    }
    
    zip.writeZip(zipPath);
    
    // Final status update
    await ctx.telegram.editMessageText(
      statusMsg.chat.id, 
      statusMsg.message_id, 
      undefined, 
      `✅ *${count} 🎮 UID(s) Successfully Generated*\n*Name Used:* ${finalName}\n*File:* ${zipFileName}\n\n_Sending ZIP file..._`,
      { parse_mode: 'Markdown' }
    );
    
    await ctx.replyWithDocument({ 
      source: zipPath,
      filename: zipFileName
    });
    
    // Increment counter for next request
    zipCounter++;
    
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
const cron = require('node-cron');
const axios = require('axios');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const CHANNEL_ID = process.env.CHANNEL_ID;

var cronJobs = {};

const PROMPTS = {
  morning: `Write a WhatsApp channel post about latest AI news from last 24 hours.
Format exactly:
🌅 *AI MORNING BRIEF*
━━━━━━━━━━━━━━━━━━━━
📌 *[Headline 1]*
[2-3 lines in Hinglish]
📌 *[Headline 2]*
[2-3 lines in Hinglish]
📌 *[Headline 3]*
[2-3 lines in Hinglish]
━━━━━━━━━━━━━━━━━━━━
🤖 _Powered by AI Daily_`,

  afternoon: `Write a WhatsApp post about ONE useful AI tool today.
Format exactly:
☀️ *AI TOOL SPOTLIGHT*
━━━━━━━━━━━━━━━━━━━━
🔧 *Tool: [NAME]*
❓ *Kya karta hai?*
[2-3 lines in Hinglish]
🚀 *Kyu try karo?*
[2-3 lines in Hinglish]
💰 *Price:* [Free/Paid/Freemium]
🔗 *Link:* [website]
━━━━━━━━━━━━━━━━━━━━
🤖 _Powered by AI Daily_`,

  evening: `Write a WhatsApp deep-dive on biggest AI story this week.
Format exactly:
🌆 *AI BIG STORY*
━━━━━━━━━━━━━━━━━━━━
🔥 *[Story Title]*
📖 *Kya hua?*
[3-4 lines in Hinglish]
💡 *Iska matlab kya hai?*
[2-3 lines in Hinglish]
🌏 *India ke liye?*
[1-2 lines in Hinglish]
━━━━━━━━━━━━━━━━━━━━
🤖 _Powered by AI Daily_`,

  night: `Write a fun WhatsApp post with a mind-blowing AI fact.
Format exactly:
🌙 *AI FACT OF THE DAY*
━━━━━━━━━━━━━━━━━━━━
🤯 *[Title]*
[3-4 fun lines in Hinglish]
💬 *Tumhara kya opinion hai? Reply karo!*
━━━━━━━━━━━━━━━━━━━━
🔁 _Share karo AI lovers ke saath!_
🤖 _Powered by AI Daily_`
};

async function generatePost(type) {
  try {
    var res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        max_tokens: 600,
        messages: [
          { role: 'system', content: 'You are an AI news curator for WhatsApp. Write in Hinglish. Use *bold* and _italic_ formatting.' },
          { role: 'user', content: PROMPTS[type] || PROMPTS.morning }
        ]
      },
      { headers: { 'Authorization': 'Bearer ' + GROQ_API_KEY, 'Content-Type': 'application/json' } }
    );
    return res.data.choices[0].message.content.trim();
  } catch(e) {
    console.error('Groq error:', e.message);
    return null;
  }
}

function timeToCron(timeStr) {
  var parts = timeStr.split(':');
  return parts[1] + ' ' + parts[0] + ' * * *';
}

function scheduleAll(client, times) {
  Object.values(cronJobs).forEach(function(job) { if(job) job.stop(); });
  cronJobs = {};
  Object.entries(times).forEach(function(entry) {
    var name = entry[0], time = entry[1];
    cronJobs[name] = cron.schedule(timeToCron(time), async function() {
      console.log('Posting ' + name + '...');
      var content = await generatePost(name);
      if (content) {
        try {
          await client.sendMessage(CHANNEL_ID, content);
          console.log('✅ Posted: ' + name);
        } catch(e) {
          console.log('Post error:', e.message);
        }
      }
    }, { timezone: 'Asia/Kolkata' });
    console.log(name + ' scheduled at ' + time + ' IST');
  });
}

function startChannelAutoPoster(client, times) {
  times = times || { morning:'08:00', afternoon:'13:00', evening:'18:00', night:'22:00' };
  console.log('Auto-Poster started!');
  scheduleAll(client, times);
}

function reschedulePost(times, client) {
  scheduleAll(client, times);
}

module.exports = { startChannelAutoPoster, generatePost, reschedulePost };

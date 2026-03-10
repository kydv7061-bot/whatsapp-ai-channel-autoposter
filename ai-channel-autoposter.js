const cron = require('node-cron');
const axios = require('axios');

var cronJobs = {};
var postHistory = [];

const HASHTAGS = {
  morning: '#AINews #TechNews #ArtificialIntelligence #Hinglish #AIDaily',
  afternoon: '#AITools #TechTools #ProductivityTools #AIDaily',
  evening: '#AIStory #TechUpdate #DeepDive #AIDaily',
  night: '#AIFacts #DidYouKnow #TechFacts #AIDaily'
};

async function fetchRealNews() { 
  try {
    var apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) return null;
    var res = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: 'artificial intelligence OR AI technology',
        sortBy: 'publishedAt',
        language: 'en',
        pageSize: 5,
        apiKey: apiKey
      }
    });
    if (!res.data.articles || res.data.articles.length === 0) return null;
    return res.data.articles.slice(0, 3).map(function(a) {
      return '• ' + a.title + ' (' + a.source.name + ')';
    }).join('\n');
  } catch(e) {
    console.log('News API error:', e.message);
    return null;
  }
}

async function generatePost(type) {
  try {
    var newsContext = '';
    if (type === 'morning' || type === 'evening') {
      var news = await fetchRealNews();
      if (news) newsContext = '\n\nReal news headlines to base your post on:\n' + news;
    }

    var prompts = {
      morning: `Write a WhatsApp/Telegram channel post about latest AI news.${newsContext}
Format exactly like this:
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

      afternoon: `Write a Telegram post about ONE useful AI tool today.
Format exactly like this:
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

      evening: `Write a Telegram deep-dive on biggest AI story.${newsContext}
Format exactly like this:
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

      night: `Write a fun Telegram post with a mind-blowing AI fact.
Format exactly like this:
🌙 *AI FACT OF THE DAY*
━━━━━━━━━━━━━━━━━━━━
🤯 *[Title]*
[3-4 fun lines in Hinglish]

💬 *Tumhara kya opinion hai? Comment karo!*
━━━━━━━━━━━━━━━━━━━━
🔁 _Share karo AI lovers ke saath!_
🤖 _Powered by AI Daily_`
    };

    var res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        max_tokens: 700,
        messages: [
          { role: 'system', content: 'You are an AI news curator for Telegram. Write in Hinglish (Hindi+English mix). Use *bold* and _italic_ Telegram formatting. Be engaging and informative.' },
          { role: 'user', content: prompts[type] || prompts.morning }
        ]
      },
      { headers: { 'Authorization': 'Bearer ' + process.env.GROQ_API_KEY, 'Content-Type': 'application/json' } }
    );

    var content = res.data.choices[0].message.content.trim();
    // Add hashtags
    content = content + '\n\n' + HASHTAGS[type];
    
    // Save to history
    postHistory.unshift({
      type: type,
      time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      preview: content.substring(0, 80) + '...'
    });
    if (postHistory.length > 20) postHistory.pop();

    return content;
  } catch(e) {
    console.error('Groq error:', e.message);
    return null;
  }
}

function timeToCron(timeStr) {
  var parts = timeStr.split(':');
  return parts[1] + ' ' + parts[0] + ' * * *';
}

function scheduleAll(sendFn, times) {
  Object.values(cronJobs).forEach(function(job) { try { job.stop(); } catch(e) {} });
  cronJobs = {};
  Object.entries(times).forEach(function(entry) {
    var name = entry[0], time = entry[1];
    cronJobs[name] = cron.schedule(timeToCron(time), async function() {
      console.log('Posting ' + name + '...');
      var content = await generatePost(name);
      if (content) {
        try {
          await sendFn(content);
          console.log('✅ Posted: ' + name);
        } catch(e) {
          console.log('Post error:', e.message);
        }
      }
    }, { timezone: 'Asia/Kolkata' });
    console.log(name + ' scheduled at ' + time + ' IST');
  });
}

function startChannelAutoPoster(sendFn, times) {
  times = times || { morning:'08:00', afternoon:'13:00', evening:'18:00', night:'22:00' };
  console.log('Auto-Poster started!');
  scheduleAll(sendFn, times);
}

function reschedulePost(times, sendFn) {
  scheduleAll(sendFn, times);
}

function getHistory() {
  return postHistory;
}

module.exports = { startChannelAutoPoster, generatePost, reschedulePost, getHistory };

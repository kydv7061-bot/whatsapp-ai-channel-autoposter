const nodeCron = require('node-cron');
const axios = require('axios');
require('dotenv').config();

async function generatePost(type) {
    const prompts = {
        'morning': 'Generate a brief AI news update in Hinglish for morning. Format with WhatsApp bold and italic. Keep it under 150 words.',
        'afternoon': 'Generate an AI tool spotlight post in Hinglish for afternoon. Format with WhatsApp bold and italic. Keep it under 150 words.',
        'evening': 'Generate a big AI story summary in Hinglish for evening. Format with WhatsApp bold and italic. Keep it under 150 words.',
        'night': 'Generate an interesting AI fact of the day in Hinglish for night. Format with WhatsApp bold and italic. Keep it under 150 words.'
    };

    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompts[type] || prompts['morning'] }]
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Error generating post:', error);
        return `*${type.toUpperCase()}* - _AI Post Generation Error_`;
    }
}

function startChannelAutoPoster(client, times) {
    const jobs = [];
    const types = ['morning', 'afternoon', 'evening', 'night'];

    types.forEach((type, index) => {
        const cronTime = times[index];
        const job = nodeCron.schedule(cronTime, async () => {
            try {
                const post = await generatePost(type);
                await client.sendMessage(process.env.CHANNEL_ID, post);
                console.log(`${type.toUpperCase()} post sent successfully`);
            } catch (error) {
                console.error(`Error sending ${type} post:`, error);
            }
        }, { timezone: 'Asia/Kolkata' });
        jobs.push(job);
    });
    return jobs;
}

function reschedulePost(times, client) {
    const currentJobs = nodeCron.getTasks();
    currentJobs.forEach(task => task.stop());
    const newJobs = startChannelAutoPoster(client, times);
    return newJobs;
}

module.exports = { generatePost, startChannelAutoPoster, reschedulePost };
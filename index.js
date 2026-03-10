// index.js

const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const { Client } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/whatsapp-ai-posts', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Session management
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
}));

// WhatsApp client initialization
const client = new Client();

client.on('qr', (qr) => {
    QRCode.toDataURL(qr, (err, url) => {
        if (err) {
            console.error('Error generating QR Code', err);
            return;
        }
        // Display QR code to the user
        console.log('QR Code generated:', url);
    });
});

client.on('ready', () => {
    console.log('WhatsApp Client is ready!');
});

// POST endpoint for sending messages
app.post('/send', async (req, res) => {
    const { number, message } = req.body;
    try {
        await client.sendMessage(`${number}@c.us`, message);
        res.status(200).send('Message sent successfully');
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).send('Error sending message');
    }
});

// POST endpoint for rescheduling
app.post('/reschedule', (req, res) => {
    // Logic for rescheduling goes here
    res.status(200).send('Rescheduling functionality not implemented yet');
});

// Dashboard setup (template would need to be created separately for a full dashboard)
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html')); // Create dashboard.html with cyan JARVIS theme
});

// Error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Handle the error, e.g. log it or shut down the application
});

// Start the Express server
app.listen(PORT, () => {
    client.initialize();
    console.log(`Server is running on port ${PORT}`);
});

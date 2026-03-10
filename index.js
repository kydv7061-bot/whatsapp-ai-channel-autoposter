const { Client, LocalAuth } = require('whatsapp-web.js');
const mongoose = require('mongoose');
const { startChannelAutoPoster, generatePost, reschedulePost } = require('./ai-channel-autoposter');
const express = require('express');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

var qrData = '';
var status = 'starting';
var currentClient = null;
var scheduledTimes = { morning: '08:00', afternoon: '13:00', evening: '18:00', night: '22:00' };

// ─── MONGODB SESSION ──────────────────────────────────────
const SessionSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true }
});
const Session = mongoose.model('Session', SessionSchema);

function readDirRecursive(dir) {
  var result = {};
  if (!fs.existsSync(dir)) return result;
  try {
    fs.readdirSync(dir).forEach(function(file) {
      var fullPath = path.join(dir, file);
      try {
        var stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          result[file] = readDirRecursive(fullPath);
        } else if (stat.size > 0 && stat.size < 8 * 1024 * 1024) { // skip files > 10MB
          result[file] = fs.readFileSync(fullPath, 'base64');
        }
      } catch(e) {}
    });
  } catch(e) {}
  return result;
}

function writeDirRecursive(files, base) {
  base = base || '/tmp/.wwebjs_auth';
  try {
    if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
    Object.entries(files).forEach(function(entry) {
      var name = entry[0], val = entry[1];
      var fullPath = path.join(base, name);
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        writeDirRecursive(val, fullPath);
      } else if (typeof val === 'string' && val.length > 0) {
        try {
          fs.writeFileSync(fullPath, Buffer.from(val, 'base64'));
        } catch(e) {}
      }
    });
  } catch(e) {
    console.log('Write error:', e.message);
  }
}

async function saveSession() {
  try {
    var sessionDir = '/tmp/.wwebjs_auth';
    if (!fs.existsSync(sessionDir)) return;
    var data = readDirRecursive(sessionDir);
    if (!data || Object.keys(data).length === 0) return;
    await Session.findOneAndUpdate(
      { name: 'main' },
      { name: 'main', data: data },
      { upsert: true, new: true }
    );
    console.log('✅ Session saved!');
  } catch(e) {
    console.log('Save error:', e.message);
  }
}

async function restoreSession() {
  try {
    var doc = await Session.findOne({ name: 'main' });
    if (!doc) { console.log('No saved session'); return false; }
    writeDirRecursive(doc.data, '/tmp/.wwebjs_auth');
    console.log('✅ Session restored!');
    return true;
  } catch(e) {
    console.log('Restore error:', e.message);
    return false;
  }
}

// ─── DASHBOARD ────────────────────────────────────────────
app.get('/', function(req, res) {
  var isConnected = status === 'connected';
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JARVIS Control Panel</title>
  ${!isConnected ? '<meta http-equiv="refresh" content="8">' : ''}
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#030810; min-height:100vh; font-family:'Share Tech Mono',monospace; color:#00d4ff; padding:16px; background-image:radial-gradient(ellipse at 50% 0%, rgba(0,100,180,0.12) 0%, transparent 60%); }
    .header { text-align:center; padding:20px 0 16px; }
    .brand { font-size:10px; letter-spacing:8px; color:#0088bb; }
    .title { font-size:28px; font-weight:900; letter-spacing:6px; background:linear-gradient(90deg,#00d4ff,#0077ff,#00d4ff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
    .divider { height:1px; background:linear-gradient(90deg,transparent,#00d4ff,transparent); margin:12px 0; }
    .status-bar { display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:16px; }
    .dot { width:8px; height:8px; border-radius:50%; background:${isConnected ? '#00ff66' : '#ffaa00'}; box-shadow:0 0 8px ${isConnected ? '#00ff66' : '#ffaa00'}; animation:pulse 1.5s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    .status-text { font-size:11px; letter-spacing:3px; color:${isConnected ? '#00ff66' : '#ffaa00'}; }
    .card { background:rgba(0,15,30,0.85); border:1px solid rgba(0,180,255,0.18); border-radius:8px; padding:16px; margin-bottom:12px; }
    .card-title { font-size:9px; letter-spacing:4px; color:#0088bb; margin-bottom:12px; }
    .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .btn-green { background:rgba(0,80,30,0.3); border:1px solid rgba(0,255,100,0.35); color:#00ff88; padding:12px 8px; border-radius:4px; font-family:'Share Tech Mono',monospace; font-size:11px; cursor:pointer; width:100%; }
    .time-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
    .time-label { font-size:11px; color:#aaccdd; }
    .time-input { background:rgba(0,0,0,0.4); border:1px solid rgba(0,180,255,0.3); color:#00d4ff; padding:6px 10px; border-radius:3px; font-family:'Share Tech Mono',monospace; font-size:13px; width:90px; text-align:center; }
    .save-btn { background:rgba(0,100,40,0.4); border:1px solid rgba(0,255,100,0.3); color:#00ff66; padding:10px; border-radius:4px; font-family:'Share Tech Mono',monospace; font-size:11px; cursor:pointer; width:100%; margin-top:8px; }
    .toast { display:none; position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:rgba(0,20,10,0.95); border:1px solid #00ff66; color:#00ff66; padding:10px 24px; border-radius:4px; font-size:12px; z-index:999; white-space:nowrap; }
    .qr-wrap { background:white; padding:14px; border-radius:6px; margin:8px auto; display:block; width:fit-content; }
    .qr-wrap img { width:240px; height:240px; display:block; }
    .hint { font-size:11px; color:#aaccdd; text-align:center; line-height:1.8; margin-top:8px; }
    .spin { width:32px; height:32px; border:2px solid #003344; border-top-color:#00d4ff; border-radius:50%; animation:spin 1s linear infinite; margin:12px auto; }
    @keyframes spin { to{transform:rotate(360deg);} }
  </style>
</head>
<body>
<div class="header">
  <div class="brand">STARK INDUSTRIES</div>
  <div class="title">J.A.R.V.I.S</div>
  <div class="brand" style="margin-top:4px">CONTROL PANEL</div>
</div>
<div class="divider"></div>
<div class="status-bar">
  <div class="dot"></div>
  <div class="status-text">${isConnected ? 'SYSTEM ONLINE' : status === 'qr' ? 'SCAN QR CODE' : 'INITIALIZING...'}</div>
</div>

${status === 'qr' && qrData ? `
<div class="card">
  <div class="card-title">● SCAN TO CONNECT</div>
  <div class="qr-wrap"><img src="${qrData}"/></div>
  <div class="hint">WhatsApp → <b>Linked Devices</b><br/>→ <b>Link a Device</b> → Scan karo</div>
</div>
` : !isConnected ? `
<div class="card" style="text-align:center">
  <div class="spin"></div>
  <div class="hint">Please wait... ☕</div>
</div>
` : `
<div class="card">
  <div class="card-title">● INSTANT POST</div>
  <div class="grid2">
    <button class="btn-green" onclick="sendPost('morning')">🌅 Morning Brief</button>
    <button class="btn-green" onclick="sendPost('afternoon')">☀️ Tool Spotlight</button>
    <button class="btn-green" onclick="sendPost('evening')">🌆 Big Story</button>
    <button class="btn-green" onclick="sendPost('night')">🌙 AI Fact</button>
  </div>
</div>
<div class="card">
  <div class="card-title">● RESCHEDULE POSTS (IST)</div>
  <div class="time-row"><span class="time-label">🌅 Morning Brief</span><input type="time" class="time-input" id="t_morning" value="${scheduledTimes.morning}"/></div>
  <div class="time-row"><span class="time-label">☀️ Tool Spotlight</span><input type="time" class="time-input" id="t_afternoon" value="${scheduledTimes.afternoon}"/></div>
  <div class="time-row"><span class="time-label">🌆 Big Story</span><input type="time" class="time-input" id="t_evening" value="${scheduledTimes.evening}"/></div>
  <div class="time-row"><span class="time-label">🌙 AI Fact</span><input type="time" class="time-input" id="t_night" value="${scheduledTimes.night}"/></div>
  <button class="save-btn" onclick="saveSchedule()">💾 SAVE SCHEDULE</button>
</div>
`}

<div class="toast" id="toast"></div>
<script>
function showToast(msg, color) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  t.style.borderColor = color || '#00ff66';
  t.style.color = color || '#00ff66';
  setTimeout(function(){ t.style.display='none'; }, 3500);
}
function sendPost(type) {
  showToast('⏳ Generating post...', '#ffaa00');
  fetch('/send?type=' + type)
    .then(r => r.json())
    .then(d => { if(d.ok) showToast('✅ Posted to channel!'); else showToast('❌ ' + d.error, '#ff4444'); })
    .catch(() => showToast('❌ Network error!', '#ff4444'));
}
function saveSchedule() {
  var data = {
    morning: document.getElementById('t_morning').value,
    afternoon: document.getElementById('t_afternoon').value,
    evening: document.getElementById('t_evening').value,
    night: document.getElementById('t_night').value
  };
  fetch('/reschedule', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) })
    .then(r => r.json())
    .then(d => { if(d.ok) showToast('✅ Schedule saved!'); else showToast('❌ Error', '#ff4444'); });
}
</script>
</body>
</html>`);
});

app.get('/send', async function(req, res) {
  try {
    if (status !== 'connected') return res.json({ ok: false, error: 'Bot not connected!' });
    var content = await generatePost(req.query.type || 'morning');
    if (!content) return res.json({ ok: false, error: 'Groq API failed' });
    await currentClient.sendMessage(process.env.CHANNEL_ID, content);
    console.log('✅ Post sent: ' + req.query.type);
    res.json({ ok: true });
  } catch(e) {
    console.log('Send error:', e.message);
    if (e.message && e.message.includes('detached')) {
      setTimeout(function() { process.exit(1); }, 500);
    }
    res.json({ ok: false, error: e.message });
  }
});

app.post('/reschedule', function(req, res) {
  try {
    scheduledTimes = req.body;
    reschedulePost(scheduledTimes, currentClient);
    res.json({ ok: true });
  } catch(e) { res.json({ ok: false, error: e.message }); }
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', function() {
  console.log('JARVIS started on port ' + PORT);
});

async function initClient() {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '/tmp/.wwebjs_auth' }),
    puppeteer: {
      executablePath: '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-features=site-per-process']
    }
  });

  currentClient = client;

  client.on('qr', async function(qr) {
    status = 'qr';
    qrData = await qrcode.toDataURL(qr, { errorCorrectionLevel: 'H', margin: 2, width: 400 });
    console.log('QR Ready!');
  });

  client.on('ready', async function() {
    status = 'connected';
    qrData = '';
    console.log('✅ Bot Ready!');
    await saveSession();
    setInterval(saveSession, 3 * 60 * 1000);
    startChannelAutoPoster(client, scheduledTimes);
  });

  client.on('auth_failure', async function() {
    console.log('Auth failed! Clearing session...');
    try { await Session.deleteOne({ name: 'main' }); } catch(e) {}
    setTimeout(function() { process.exit(1); }, 1000);
  });

  client.on('disconnected', function(reason) {
    console.log('Disconnected:', reason);
    setTimeout(function() { process.exit(1); }, 1000);
  });

  process.on('unhandledRejection', function(reason) {
    console.log('Unhandled:', reason && reason.message);
  });

  client.initialize();
}

async function start() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB connected!');
  await restoreSession();
  await initClient();
}

start().catch(function(e) {
  console.error('Startup error:', e.message);
  process.exit(1);
});

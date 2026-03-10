const mongoose = require('mongoose');
const { startChannelAutoPoster, generatePost, reschedulePost, getHistory } = require('./ai-channel-autoposter');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

// ─── MONGODB SCHEDULE PERSISTENCE ────────────────────────
const ScheduleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  times: { type: mongoose.Schema.Types.Mixed, required: true }
});
const Schedule = mongoose.model('Schedule', ScheduleSchema);

var scheduledTimes = { morning: '08:00', afternoon: '13:00', evening: '18:00', night: '22:00' };

async function saveSchedule() {
  try {
    await Schedule.findOneAndUpdate(
      { name: 'main' },
      { name: 'main', times: scheduledTimes },
      { upsert: true }
    );
  } catch(e) {}
}

async function loadSchedule() {
  try {
    var doc = await Schedule.findOne({ name: 'main' });
    if (doc) {
      scheduledTimes = doc.times;
      console.log('✅ Schedule loaded from DB!');
    }
  } catch(e) {}
}

// ─── SEND TO TELEGRAM ─────────────────────────────────────
async function sendToChannel(content) {
  var url = 'https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage';
  try {
    var res = await axios.post(url, {
      chat_id: CHANNEL_ID,
      text: content,
      parse_mode: 'Markdown'
    });
    return res.data;
  } catch(e) {
    var errMsg = e.response ? JSON.stringify(e.response.data) : e.message;
    console.log('Telegram error:', errMsg);
    throw new Error(errMsg);
  }
}

// ─── DASHBOARD ────────────────────────────────────────────
app.get('/', function(req, res) {
  var history = getHistory();
  var historyHTML = history.length === 0 ? '<div class="no-history">Abhi koi post nahi gayi</div>' :
    history.map(function(h) {
      return '<div class="history-item"><span class="h-type">' + h.type.toUpperCase() + '</span><span class="h-time">' + h.time + '</span><div class="h-preview">' + h.preview + '</div></div>';
    }).join('');

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JARVIS Control Panel</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#030810; min-height:100vh; font-family:'Share Tech Mono',monospace; color:#00d4ff; padding:16px; background-image:radial-gradient(ellipse at 50% 0%, rgba(0,100,180,0.12) 0%, transparent 60%); }
    .header { text-align:center; padding:20px 0 16px; }
    .brand { font-size:10px; letter-spacing:8px; color:#0088bb; }
    .title { font-size:28px; font-weight:900; letter-spacing:6px; background:linear-gradient(90deg,#00d4ff,#0077ff,#00d4ff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
    .divider { height:1px; background:linear-gradient(90deg,transparent,#00d4ff,transparent); margin:12px 0; }
    .status-bar { display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:16px; }
    .dot { width:8px; height:8px; border-radius:50%; background:#00ff66; box-shadow:0 0 8px #00ff66; animation:pulse 1.5s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    .status-text { font-size:11px; letter-spacing:3px; color:#00ff66; }
    .card { background:rgba(0,15,30,0.85); border:1px solid rgba(0,180,255,0.18); border-radius:8px; padding:16px; margin-bottom:12px; }
    .card-title { font-size:9px; letter-spacing:4px; color:#0088bb; margin-bottom:12px; }
    .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .btn-green { background:rgba(0,80,30,0.3); border:1px solid rgba(0,255,100,0.35); color:#00ff88; padding:12px 8px; border-radius:4px; font-family:'Share Tech Mono',monospace; font-size:11px; cursor:pointer; width:100%; transition:all 0.2s; }
    .btn-green:hover { background:rgba(0,120,50,0.4); }
    .btn-preview { background:rgba(0,50,80,0.3); border:1px solid rgba(0,180,255,0.35); color:#00d4ff; padding:12px 8px; border-radius:4px; font-family:'Share Tech Mono',monospace; font-size:11px; cursor:pointer; width:100%; margin-top:6px; }
    .time-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
    .time-label { font-size:11px; color:#aaccdd; }
    .time-input { background:rgba(0,0,0,0.4); border:1px solid rgba(0,180,255,0.3); color:#00d4ff; padding:6px 10px; border-radius:3px; font-family:'Share Tech Mono',monospace; font-size:13px; width:90px; text-align:center; }
    .save-btn { background:rgba(0,100,40,0.4); border:1px solid rgba(0,255,100,0.3); color:#00ff66; padding:10px; border-radius:4px; font-family:'Share Tech Mono',monospace; font-size:11px; cursor:pointer; width:100%; margin-top:8px; }
    .toast { display:none; position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:rgba(0,20,10,0.95); border:1px solid #00ff66; color:#00ff66; padding:10px 24px; border-radius:4px; font-size:12px; z-index:999; white-space:nowrap; }
    .history-item { border:1px solid rgba(0,180,255,0.1); border-radius:4px; padding:10px; margin-bottom:8px; }
    .h-type { font-size:9px; letter-spacing:3px; color:#00d4ff; background:rgba(0,100,180,0.2); padding:2px 8px; border-radius:2px; }
    .h-time { font-size:9px; color:#556677; float:right; }
    .h-preview { font-size:10px; color:#8899aa; margin-top:6px; line-height:1.5; }
    .no-history { font-size:11px; color:#445566; text-align:center; padding:16px; }
    .preview-modal { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:1000; padding:20px; }
    .preview-box { background:#030810; border:1px solid #00d4ff; border-radius:8px; padding:16px; max-height:80vh; overflow-y:auto; margin-top:40px; }
    .preview-content { font-size:12px; color:#ccddee; line-height:1.8; white-space:pre-wrap; }
    .preview-close { color:#ff4444; cursor:pointer; float:right; font-size:14px; }
    .preview-send { background:rgba(0,100,40,0.4); border:1px solid #00ff66; color:#00ff66; padding:10px; border-radius:4px; font-family:'Share Tech Mono',monospace; font-size:11px; cursor:pointer; width:100%; margin-top:12px; }
  </style>
</head>
<body>
<div class="header">
  <div class="brand">STARK INDUSTRIES</div>
  <div class="title">J.A.R.V.I.S</div>
  <div class="brand" style="margin-top:4px">CONTROL PANEL — TELEGRAM</div>
</div>
<div class="divider"></div>
<div class="status-bar">
  <div class="dot"></div>
  <div class="status-text">SYSTEM ONLINE ● TELEGRAM READY</div>
</div>

<div class="card">
  <div class="card-title">● INSTANT POST</div>
  <div class="grid2">
    <button class="btn-green" onclick="sendPost('morning')">🌅 Morning Brief</button>
    <button class="btn-green" onclick="sendPost('afternoon')">☀️ Tool Spotlight</button>
    <button class="btn-green" onclick="sendPost('evening')">🌆 Big Story</button>
    <button class="btn-green" onclick="sendPost('night')">🌙 AI Fact</button>
  </div>
  <div class="grid2" style="margin-top:6px">
    <button class="btn-preview" onclick="previewPost('morning')">👁 Preview Morning</button>
    <button class="btn-preview" onclick="previewPost('afternoon')">👁 Preview Afternoon</button>
    <button class="btn-preview" onclick="previewPost('evening')">👁 Preview Evening</button>
    <button class="btn-preview" onclick="previewPost('night')">👁 Preview Night</button>
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

<div class="card">
  <div class="card-title">● POST HISTORY (Today)</div>
  ${historyHTML}
</div>

<div class="toast" id="toast"></div>

<div class="preview-modal" id="previewModal">
  <div class="preview-box">
    <span class="preview-close" onclick="closePreview()">✕ CLOSE</span>
    <div class="card-title">● POST PREVIEW</div>
    <div class="preview-content" id="previewContent"></div>
    <button class="preview-send" id="previewSendBtn">📤 SEND THIS POST</button>
  </div>
</div>

<script>
var currentPreviewType = '';
function showToast(msg, color) {
  var t = document.getElementById('toast');
  t.textContent = msg; t.style.display = 'block';
  t.style.borderColor = color||'#00ff66'; t.style.color = color||'#00ff66';
  setTimeout(function(){ t.style.display='none'; }, 3500);
}
function sendPost(type) {
  showToast('⏳ Generating & Posting...', '#ffaa00');
  fetch('/send?type='+type).then(r=>r.json())
    .then(d=>{ if(d.ok) { showToast('✅ Posted to Telegram!'); setTimeout(()=>location.reload(),2000); } else showToast('❌ '+d.error,'#ff4444'); })
    .catch(()=>showToast('❌ Failed!','#ff4444'));
}
function previewPost(type) {
  currentPreviewType = type;
  document.getElementById('previewContent').textContent = '⏳ Generating preview...';
  document.getElementById('previewModal').style.display = 'block';
  fetch('/preview?type='+type).then(r=>r.json())
    .then(d=>{ 
      if(d.ok) { 
        document.getElementById('previewContent').textContent = d.content;
        document.getElementById('previewSendBtn').onclick = function() {
          closePreview();
          sendPostContent(d.content);
        };
      } else {
        document.getElementById('previewContent').textContent = '❌ Error: ' + d.error;
      }
    });
}
function closePreview() {
  document.getElementById('previewModal').style.display = 'none';
}
function sendPostContent(content) {
  showToast('⏳ Sending...', '#ffaa00');
  fetch('/sendcontent', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({content: content})})
    .then(r=>r.json())
    .then(d=>{ if(d.ok) { showToast('✅ Posted!'); setTimeout(()=>location.reload(),2000); } else showToast('❌ '+d.error,'#ff4444'); });
}
function saveSchedule() {
  fetch('/reschedule',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      morning:document.getElementById('t_morning').value,
      afternoon:document.getElementById('t_afternoon').value,
      evening:document.getElementById('t_evening').value,
      night:document.getElementById('t_night').value
    })
  }).then(r=>r.json()).then(d=>{ if(d.ok) showToast('✅ Schedule Saved!'); else showToast('❌ Error','#ff4444'); });
}
</script>
</body>
</html>`);
});

app.get('/send', async function(req, res) {
  try {
    var content = await generatePost(req.query.type || 'morning');
    if (!content) return res.json({ ok: false, error: 'Groq API failed' });
    await sendToChannel(content);
    console.log('✅ Post sent: ' + req.query.type);
    res.json({ ok: true });
  } catch(e) {
    console.log('Send error:', e.message);
    res.json({ ok: false, error: e.message });
  }
});

app.get('/preview', async function(req, res) {
  try {
    var content = await generatePost(req.query.type || 'morning');
    if (!content) return res.json({ ok: false, error: 'Groq API failed' });
    res.json({ ok: true, content: content });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

app.post('/sendcontent', async function(req, res) {
  try {
    await sendToChannel(req.body.content);
    res.json({ ok: true });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

app.post('/reschedule', async function(req, res) {
  try {
    scheduledTimes = req.body;
    reschedulePost(scheduledTimes, sendToChannel);
    await saveSchedule();
    res.json({ ok: true });
  } catch(e) { res.json({ ok: false, error: e.message }); }
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', function() {
  console.log('JARVIS started on port ' + PORT);
});

async function start() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB connected!');
  await loadSchedule();
  startChannelAutoPoster(sendToChannel, scheduledTimes);
  console.log('✅ Bot Ready!');
}

start().catch(function(e) {
  console.error('Startup error:', e.message);
  process.exit(1);
});

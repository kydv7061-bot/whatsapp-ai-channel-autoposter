const mongoose = require('mongoose');
const { startChannelAutoPoster, generatePost, reschedulePost, getHistory } = require('./ai-channel-autoposter');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

const ScheduleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  times: { type: mongoose.Schema.Types.Mixed, required: true }
});
const Schedule = mongoose.model('Schedule', ScheduleSchema);

var scheduledTimes = { morning: '08:00', afternoon: '13:00', evening: '18:00', night: '22:00' };
var totalPostsSent = 0;
var botStartTime = Date.now();

async function saveSchedule() {
  try {
    await Schedule.findOneAndUpdate({ name: 'main' }, { name: 'main', times: scheduledTimes }, { upsert: true });
  } catch(e) {}
}

async function loadSchedule() {
  try {
    var doc = await Schedule.findOne({ name: 'main' });
    if (doc) { scheduledTimes = doc.times; console.log('✅ Schedule loaded!'); }
  } catch(e) {}
}

async function sendToChannel(content) {
  var url = 'https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage';
  try {
    var res = await axios.post(url, { chat_id: CHANNEL_ID, text: content, parse_mode: 'Markdown' });
    totalPostsSent++;
    return res.data;
  } catch(e) {
    var errMsg = e.response ? JSON.stringify(e.response.data) : e.message;
    console.log('Telegram error:', errMsg);
    throw new Error(errMsg);
  }
}

async function getChannelInfo() {
  try {
    var res = await axios.get('https://api.telegram.org/bot' + BOT_TOKEN + '/getChat?chat_id=' + CHANNEL_ID);
    return res.data.result;
  } catch(e) { return null; }
}

async function getMemberCount() {
  try {
    var res = await axios.get('https://api.telegram.org/bot' + BOT_TOKEN + '/getChatMemberCount?chat_id=' + CHANNEL_ID);
    return res.data.result;
  } catch(e) { return '—'; }
}

function getUptime() {
  var diff = Date.now() - botStartTime;
  var h = Math.floor(diff / 3600000);
  var m = Math.floor((diff % 3600000) / 60000);
  return h + 'h ' + m + 'm';
}

// ─── DASHBOARD ────────────────────────────────────────────
app.get('/', async function(req, res) {
  var history = getHistory();
  var members = await getMemberCount();
  var uptime = getUptime();

  var historyHTML = history.length === 0
    ? '<div class="empty-state">NO POSTS YET TODAY</div>'
    : history.map(function(h) {
        var icons = { morning:'🌅', afternoon:'☀️', evening:'🌆', night:'🌙' };
        return `<div class="log-entry">
          <div class="log-header">
            <span class="log-type">${icons[h.type]||'📡'} ${h.type.toUpperCase()}</span>
            <span class="log-time">${h.time}</span>
          </div>
          <div class="log-preview">${h.preview}</div>
        </div>`;
      }).join('');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>J.A.R.V.I.S — CONTROL</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet">
<style>
:root {
  --cyan: #00f5ff;
  --blue: #0088ff;
  --green: #00ff88;
  --orange: #ff8800;
  --red: #ff3344;
  --bg: #010812;
  --card: rgba(0,20,40,0.8);
  --border: rgba(0,200,255,0.15);
}
* { margin:0; padding:0; box-sizing:border-box; }
body {
  background: var(--bg);
  min-height: 100vh;
  font-family: 'Share Tech Mono', monospace;
  color: var(--cyan);
  overflow-x: hidden;
}

/* ── ANIMATED GRID BG ── */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(0,200,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,200,255,0.03) 1px, transparent 1px);
  background-size: 40px 40px;
  animation: gridMove 20s linear infinite;
  pointer-events: none;
  z-index: 0;
}
@keyframes gridMove { 0%{background-position:0 0} 100%{background-position:40px 40px} }

/* ── GLOW ORBS ── */
body::after {
  content: '';
  position: fixed;
  width: 600px; height: 600px;
  background: radial-gradient(circle, rgba(0,100,255,0.08) 0%, transparent 70%);
  top: -200px; left: 50%; transform: translateX(-50%);
  pointer-events: none;
  z-index: 0;
  animation: breathe 4s ease-in-out infinite;
}
@keyframes breathe { 0%,100%{opacity:0.6;transform:translateX(-50%) scale(1)} 50%{opacity:1;transform:translateX(-50%) scale(1.1)} }

.container { position: relative; z-index: 1; max-width: 800px; margin: 0 auto; padding: 20px 16px; }

/* ── HEADER ── */
.header { text-align: center; padding: 30px 0 20px; position: relative; }
.stark-label {
  font-family: 'Orbitron', monospace;
  font-size: 9px;
  letter-spacing: 12px;
  color: rgba(0,200,255,0.4);
  margin-bottom: 8px;
}
.jarvis-title {
  font-family: 'Orbitron', monospace;
  font-size: clamp(28px, 8vw, 52px);
  font-weight: 900;
  letter-spacing: 8px;
  background: linear-gradient(135deg, #00f5ff 0%, #0088ff 40%, #00f5ff 80%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 20px rgba(0,200,255,0.5));
  animation: titlePulse 3s ease-in-out infinite;
}
@keyframes titlePulse { 0%,100%{filter:drop-shadow(0 0 20px rgba(0,200,255,0.5))} 50%{filter:drop-shadow(0 0 40px rgba(0,200,255,0.9))} }
.sub-label {
  font-size: 9px;
  letter-spacing: 6px;
  color: rgba(0,200,255,0.35);
  margin-top: 6px;
}

/* ── DIVIDER ── */
.divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--cyan), var(--blue), var(--cyan), transparent);
  margin: 16px 0;
  position: relative;
}
.divider::after {
  content: '◆';
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%,-50%);
  color: var(--cyan);
  font-size: 10px;
  background: var(--bg);
  padding: 0 8px;
}

/* ── STATUS BAR ── */
.status-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 20px;
  padding: 8px 20px;
  background: rgba(0,255,136,0.05);
  border: 1px solid rgba(0,255,136,0.2);
  border-radius: 4px;
}
.pulse-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 12px var(--green);
  animation: dotPulse 1.5s ease-in-out infinite;
}
@keyframes dotPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
.status-text { font-size: 10px; letter-spacing: 4px; color: var(--green); }

/* ── STATS ROW ── */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.stat-box {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px 8px;
  text-align: center;
  position: relative;
  overflow: hidden;
}
.stat-box::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--cyan), transparent);
}
.stat-val { font-family: 'Orbitron', monospace; font-size: 22px; font-weight: 700; color: var(--cyan); }
.stat-label { font-size: 8px; letter-spacing: 3px; color: rgba(0,200,255,0.4); margin-top: 4px; }

/* ── CARD ── */
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  position: relative;
  backdrop-filter: blur(10px);
}
.card::before {
  content: '';
  position: absolute;
  top: 0; left: 20px; right: 20px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0,200,255,0.4), transparent);
}
.card-title {
  font-size: 8px;
  letter-spacing: 5px;
  color: rgba(0,150,200,0.7);
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-title::before { content: ''; width: 20px; height: 1px; background: var(--blue); }
.card-title::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, var(--blue), transparent); }

/* ── BUTTONS ── */
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.btn-post {
  background: rgba(0,255,136,0.06);
  border: 1px solid rgba(0,255,136,0.3);
  color: var(--green);
  padding: 14px 8px;
  border-radius: 4px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px;
  cursor: pointer;
  width: 100%;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}
.btn-post:hover {
  background: rgba(0,255,136,0.15);
  border-color: var(--green);
  box-shadow: 0 0 15px rgba(0,255,136,0.2);
  transform: translateY(-1px);
}
.btn-post:active { transform: translateY(0); }
.btn-preview {
  background: rgba(0,150,255,0.06);
  border: 1px solid rgba(0,150,255,0.25);
  color: rgba(0,200,255,0.7);
  padding: 10px 8px;
  border-radius: 4px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px;
  cursor: pointer;
  width: 100%;
  transition: all 0.2s;
}
.btn-preview:hover { background: rgba(0,150,255,0.12); border-color: var(--cyan); color: var(--cyan); }

/* ── TIME INPUTS ── */
.time-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.time-label { font-size: 10px; color: rgba(0,180,220,0.7); }
.time-input {
  background: rgba(0,0,0,0.5);
  border: 1px solid rgba(0,150,200,0.3);
  color: var(--cyan);
  padding: 6px 10px;
  border-radius: 3px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 13px;
  width: 95px;
  text-align: center;
  transition: border-color 0.2s;
}
.time-input:focus { outline: none; border-color: var(--cyan); box-shadow: 0 0 8px rgba(0,200,255,0.2); }
.save-btn {
  background: rgba(0,255,136,0.08);
  border: 1px solid rgba(0,255,136,0.3);
  color: var(--green);
  padding: 12px;
  border-radius: 4px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px;
  letter-spacing: 3px;
  cursor: pointer;
  width: 100%;
  margin-top: 10px;
  transition: all 0.2s;
}
.save-btn:hover { background: rgba(0,255,136,0.15); box-shadow: 0 0 15px rgba(0,255,136,0.15); }

/* ── LOG ── */
.log-entry {
  border-left: 2px solid rgba(0,150,200,0.3);
  padding: 8px 12px;
  margin-bottom: 8px;
  transition: border-color 0.2s;
}
.log-entry:hover { border-left-color: var(--cyan); }
.log-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.log-type { font-size: 9px; letter-spacing: 3px; color: var(--cyan); }
.log-time { font-size: 9px; color: rgba(0,150,200,0.4); }
.log-preview { font-size: 10px; color: rgba(0,180,220,0.5); line-height: 1.5; }
.empty-state { font-size: 10px; color: rgba(0,100,150,0.5); text-align: center; padding: 20px; letter-spacing: 3px; }

/* ── TOAST ── */
.toast {
  display: none;
  position: fixed;
  bottom: 24px; left: 50%;
  transform: translateX(-50%);
  background: rgba(0,10,20,0.95);
  border: 1px solid var(--green);
  color: var(--green);
  padding: 12px 28px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 9999;
  white-space: nowrap;
  box-shadow: 0 0 20px rgba(0,255,136,0.3);
  animation: toastIn 0.3s ease;
}
@keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }

/* ── PREVIEW MODAL ── */
.modal {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,5,15,0.92);
  z-index: 1000;
  padding: 20px;
  backdrop-filter: blur(4px);
}
.modal-box {
  background: #010e1f;
  border: 1px solid rgba(0,200,255,0.3);
  border-radius: 8px;
  padding: 20px;
  max-width: 600px;
  margin: 40px auto;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 0 40px rgba(0,150,255,0.2);
}
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.modal-title { font-size: 9px; letter-spacing: 4px; color: var(--cyan); }
.modal-close { color: var(--red); cursor: pointer; font-size: 12px; letter-spacing: 2px; }
.modal-close:hover { text-shadow: 0 0 8px var(--red); }
.preview-text {
  font-size: 12px;
  color: rgba(200,230,255,0.8);
  line-height: 1.9;
  white-space: pre-wrap;
  background: rgba(0,0,0,0.3);
  padding: 16px;
  border-radius: 4px;
  border: 1px solid rgba(0,100,150,0.2);
}
.modal-send {
  background: rgba(0,255,136,0.08);
  border: 1px solid var(--green);
  color: var(--green);
  padding: 12px;
  border-radius: 4px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px;
  letter-spacing: 3px;
  cursor: pointer;
  width: 100%;
  margin-top: 14px;
  transition: all 0.2s;
}
.modal-send:hover { background: rgba(0,255,136,0.15); box-shadow: 0 0 20px rgba(0,255,136,0.2); }

/* ── FOOTER ── */
.footer { text-align: center; padding: 20px 0; font-size: 8px; letter-spacing: 4px; color: rgba(0,100,150,0.3); }
</style>
</head>
<body>
<div class="container">

  <div class="header">
    <div class="stark-label">STARK INDUSTRIES</div>
    <div class="jarvis-title">J.A.R.V.I.S</div>
    <div class="sub-label">JUST A RATHER VERY INTELLIGENT SYSTEM</div>
  </div>

  <div class="divider"></div>

  <div class="status-bar">
    <div class="pulse-dot"></div>
    <div class="status-text">ALL SYSTEMS OPERATIONAL ● TELEGRAM ONLINE</div>
  </div>

  <div class="stats-row">
    <div class="stat-box">
      <div class="stat-val">${members}</div>
      <div class="stat-label">SUBSCRIBERS</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">${totalPostsSent}</div>
      <div class="stat-label">POSTS TODAY</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">${uptime}</div>
      <div class="stat-label">UPTIME</div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">INSTANT BROADCAST</div>
    <div class="grid2">
      <button class="btn-post" onclick="sendPost('morning')">🌅 MORNING BRIEF</button>
      <button class="btn-post" onclick="sendPost('afternoon')">☀️ TOOL SPOTLIGHT</button>
      <button class="btn-post" onclick="sendPost('evening')">🌆 BIG STORY</button>
      <button class="btn-post" onclick="sendPost('night')">🌙 AI FACT</button>
    </div>
    <div class="grid2" style="margin-top:8px">
      <button class="btn-preview" onclick="previewPost('morning')">▶ PREVIEW MORNING</button>
      <button class="btn-preview" onclick="previewPost('afternoon')">▶ PREVIEW AFTERNOON</button>
      <button class="btn-preview" onclick="previewPost('evening')">▶ PREVIEW EVENING</button>
      <button class="btn-preview" onclick="previewPost('night')">▶ PREVIEW NIGHT</button>
    </div>
  </div>

  <div class="card">
    <div class="card-title">TRANSMISSION SCHEDULE — IST</div>
    <div class="time-row"><span class="time-label">🌅 MORNING BRIEF</span><input type="time" class="time-input" id="t_morning" value="${scheduledTimes.morning}"/></div>
    <div class="time-row"><span class="time-label">☀️ TOOL SPOTLIGHT</span><input type="time" class="time-input" id="t_afternoon" value="${scheduledTimes.afternoon}"/></div>
    <div class="time-row"><span class="time-label">🌆 BIG STORY</span><input type="time" class="time-input" id="t_evening" value="${scheduledTimes.evening}"/></div>
    <div class="time-row"><span class="time-label">🌙 AI FACT</span><input type="time" class="time-input" id="t_night" value="${scheduledTimes.night}"/></div>
    <button class="save-btn" onclick="saveSchedule()">◈ SAVE TRANSMISSION SCHEDULE</button>
  </div>

  <div class="card">
    <div class="card-title">TRANSMISSION LOG</div>
    ${historyHTML}
  </div>

  <div class="footer">J.A.R.V.I.S v2.0 ● STARK INDUSTRIES ● ALL RIGHTS RESERVED</div>
</div>

<div class="toast" id="toast"></div>

<div class="modal" id="modal">
  <div class="modal-box">
    <div class="modal-header">
      <div class="modal-title">◈ POST PREVIEW</div>
      <div class="modal-close" onclick="closeModal()">✕ CLOSE</div>
    </div>
    <div class="preview-text" id="previewText">Generating...</div>
    <button class="modal-send" id="modalSendBtn">◈ TRANSMIT TO CHANNEL</button>
  </div>
</div>

<script>
var pendingContent = '';
function showToast(msg, color) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  t.style.borderColor = color||'#00ff88';
  t.style.color = color||'#00ff88';
  setTimeout(function(){ t.style.display='none'; }, 3500);
}
function sendPost(type) {
  showToast('⚡ GENERATING & TRANSMITTING...', '#ff8800');
  fetch('/send?type='+type).then(r=>r.json())
    .then(d=>{
      if(d.ok){ showToast('✅ TRANSMITTED TO CHANNEL'); setTimeout(()=>location.reload(),2000); }
      else showToast('❌ ERROR: '+d.error,'#ff3344');
    }).catch(()=>showToast('❌ NETWORK FAILURE','#ff3344'));
}
function previewPost(type) {
  pendingContent = '';
  document.getElementById('previewText').textContent = '⚡ GENERATING PREVIEW...';
  document.getElementById('modal').style.display = 'block';
  fetch('/preview?type='+type).then(r=>r.json())
    .then(d=>{
      if(d.ok){
        pendingContent = d.content;
        document.getElementById('previewText').textContent = d.content;
      } else {
        document.getElementById('previewText').textContent = '❌ ERROR: '+d.error;
      }
    });
}
document.getElementById('modalSendBtn').onclick = function() {
  if(!pendingContent) return;
  closeModal();
  showToast('⚡ TRANSMITTING...', '#ff8800');
  fetch('/sendcontent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:pendingContent})})
    .then(r=>r.json())
    .then(d=>{ if(d.ok){ showToast('✅ TRANSMITTED!'); setTimeout(()=>location.reload(),2000); } else showToast('❌ '+d.error,'#ff3344'); });
};
function closeModal() { document.getElementById('modal').style.display='none'; }
function saveSchedule() {
  fetch('/reschedule',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      morning:document.getElementById('t_morning').value,
      afternoon:document.getElementById('t_afternoon').value,
      evening:document.getElementById('t_evening').value,
      night:document.getElementById('t_night').value
    })
  }).then(r=>r.json()).then(d=>{ if(d.ok) showToast('✅ SCHEDULE SAVED'); else showToast('❌ ERROR','#ff3344'); });
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
  console.log('✅ JARVIS Online!');
}

start().catch(function(e) {
  console.error('Startup error:', e.message);
  process.exit(1);
});

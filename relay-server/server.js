// Tentry -> Phone relay server
//
// Your Tentry bot's webhook posts a signal here. This forwards it as an
// Expo push notification to your phone, which then rings the alarm even
// through silent/DND.
//
// Run with: node server.js
// Or on a free host (Render, Railway, Fly.io, etc.) so it's always on.

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const TOKENS_FILE = path.join(__dirname, 'tokens.json');

function loadTokens() {
  try {
    const raw = fs.readFileSync(TOKENS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

// Optional shared secret so randos can't trigger your alarm.
// Set this as an env var, then have your bot send header: x-webhook-secret: <value>
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'change-me';

// The app's "Register Device" button calls this automatically once it has
// a push token — no more manually editing this file and redeploying.
app.post('/register', (req, res) => {
  const { token } = req.body || {};
  if (!token || typeof token !== 'string' || !token.startsWith('ExponentPushToken')) {
    return res.status(400).json({ ok: false, error: 'invalid or missing token' });
  }
  const tokens = loadTokens();
  if (!tokens.includes(token)) {
    tokens.push(token);
    saveTokens(tokens);
  }
  res.json({ ok: true, registeredCount: tokens.length });
});

app.get('/devices', (req, res) => {
  res.json({ tokens: loadTokens() });
});

app.post('/webhook/tentry', async (req, res) => {
  const secret = req.headers['x-webhook-secret'];
  if (WEBHOOK_SECRET !== 'change-me' && secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'bad secret' });
  }

  const tokens = loadTokens();
  if (tokens.length === 0) {
    return res.status(400).json({ ok: false, error: 'no devices registered yet — open the app and tap "Register Device"' });
  }

  const payload = req.body || {};
  const symbol = payload.symbol || payload.ticker || 'Signal';
  const action = payload.action || payload.side || '';
  const message = payload.message || `${symbol} ${action}`.trim();

  const messages = tokens.map((token) => ({
    to: token,
    sound: 'default', // actual alarm sound + DND bypass is handled by the
                       // app's own notification channel, not this field
    title: 'Trading Signal',
    body: message,
    priority: 'high',
    channelId: 'signal-alarm',
    data: { payload },
  }));

  try {
    const resp = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    const data = await resp.json();
    console.log('Push sent:', data);
    res.json({ ok: true, data });
  } catch (err) {
    console.error('Push failed:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.get('/health', (req, res) => res.json({ ok: true, devicesRegistered: loadTokens().length }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Relay listening on port ${PORT}`));

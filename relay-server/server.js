// Tentry -> Phone relay server
//
// Your Tentry bot's webhook posts a signal here. This forwards it as an
// Expo push notification to your phone, which then rings the alarm even
// through silent/DND.
//
// Run with: node server.js
// Or on a free host (Render, Railway, Fly.io, etc.) so it's always on.

const express = require('express');
const app = express();
app.use(express.json());

// Paste the push token your phone showed you after running setup.
// You can register more than one device by adding more tokens here.
const DEVICE_TOKENS = [
  'ExponentPushToken[PASTE_YOUR_TOKEN_HERE]',
];

// Optional shared secret so randos can't trigger your alarm.
// Set this, then have your bot send header: x-webhook-secret: <value>
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'change-me';

app.post('/webhook/tentry', async (req, res) => {
  const secret = req.headers['x-webhook-secret'];
  if (WEBHOOK_SECRET !== 'change-me' && secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'bad secret' });
  }

  const payload = req.body || {};
  const symbol = payload.symbol || payload.ticker || 'Signal';
  const action = payload.action || payload.side || '';
  const message = payload.message || `${symbol} ${action}`.trim();

  const messages = DEVICE_TOKENS.map((token) => ({
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

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Relay listening on port ${PORT}`));

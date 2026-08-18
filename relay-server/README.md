# Tentry Relay Server

Small Express server that sits between your Tentry bot's webhook and your
phone. Bot → this server → Expo push → your phone → alarm rings.

## Setup

```bash
cd relay-server
npm install
```

1. Open `server.js`, replace `PASTE_YOUR_TOKEN_HERE` with the push token the
   app showed you after setup (starts with `ExponentPushToken[...]`).
2. Set `WEBHOOK_SECRET` to something private.
3. Point your Tentry bot's webhook at:
   `https://<your-host>/webhook/tentry`
   with header `x-webhook-secret: <your secret>` and a JSON body like:
   ```json
   { "symbol": "BTCUSDT", "action": "BUY", "message": "BTCUSDT long signal" }
   ```

## Running it

- Local test (same wifi, or via `ngrok http 3000`):
  ```bash
  npm start
  ```
- For 24/7 uptime, deploy to a free tier host: Render, Railway, Fly.io, or
  even a $0 always-free VM. This server has no heavy dependencies, so any of
  them work fine.

## Testing without your bot

```bash
curl -X POST http://localhost:3000/webhook/tentry \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: change-me" \
  -d '{"symbol":"BTCUSDT","action":"BUY"}'
```

Your phone should ring within a couple seconds, even in silent mode.

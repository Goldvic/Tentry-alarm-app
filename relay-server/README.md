# Tentry Relay Server

Small Express server that sits between your Tentry bot's webhook and your
phone. Bot → this server → Expo push → your phone → alarm rings.

## Setup

```bash
cd relay-server
npm install
```

1. Set `WEBHOOK_SECRET` as an environment variable to something private
   (don't hardcode it in server.js — the app's dashboard also stores its
   own copy of this secret and sends it on every test/real signal).
2. Deploy it (see below).
3. Open the app → Dashboard → Relay Connection → paste your deployed URL
   into "Relay Server URL" → tap **Save**, then **Register Device**.
   That's it — no manual token editing or redeploying needed anymore.
4. Point your Tentry bot's webhook at:
   `https://<your-host>/webhook/tentry`
   with header `x-webhook-secret: <your secret>` and a JSON body like:
   ```json
   { "symbol": "BTCUSDT", "action": "BUY", "message": "BTCUSDT long signal" }
   ```

## Endpoints

- `POST /register` — body `{ "token": "ExponentPushToken[...]" }`. Called
  automatically by the app. Saves the token to `tokens.json` so it survives
  restarts.
- `GET /devices` — lists currently registered tokens (for debugging).
- `POST /webhook/tentry` — what your bot calls. Requires the
  `x-webhook-secret` header once `WEBHOOK_SECRET` is set.
- `GET /health` — returns `{ ok: true, devicesRegistered: N }`.

## Running it

- Local test (same wifi, or via `ngrok http 3000`):
  ```bash
  npm start
  ```
- For 24/7 uptime, deploy to a free tier host: Render, Railway, Fly.io, or
  any always-on box. No database needed — `tokens.json` is a flat file next
  to `server.js`. On hosts with an ephemeral filesystem (some free tiers
  wipe disk on redeploy) you'll just need to tap "Register Device" again
  after a redeploy.

## Testing without your bot

```bash
curl -X POST http://localhost:3000/webhook/tentry \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: <your secret>" \
  -d '{"symbol":"BTCUSDT","action":"BUY"}'
```

Or just tap **Send Test Signal** in the app's dashboard — same thing, no
terminal needed.

Your phone should ring within a couple seconds, even in silent mode.

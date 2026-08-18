# Tentry Alarm App

Rings like an alarm — through silent/DND mode, at full volume — whenever
your Tentry bot posts a trading signal, instead of at a scheduled time.

**Important:** This app needs a custom dev client, not Expo Go. Expo Go
cannot bypass DND or force alarm-stream audio — those require native config
that only exists in a real build. That's what we're building below.

## What's in this zip

```
tentry-alarm-app/
├── App.js              → app UI + step-by-step permission flow + alarm logic
├── app.json             → Android permissions, notification channel config
├── eas.json              → EAS build profiles
├── package.json
├── assets/               → put your icon + alarm sound here (see below)
└── relay-server/          → bot webhook → push notification bridge
```

## 1. Add your assets (required before building)

The app references these files — add them yourself since I can't ship
binary audio/images in this zip:

- `assets/alarm_sound.wav` — your alarm tone (loud, looping-friendly, a few
  seconds is fine — it loops automatically)
- `assets/icon.png` — 1024x1024
- `assets/adaptive-icon.png` — 1024x1024
- `assets/splash.png` — any size, will be centered
- `assets/notification-icon.png` — 96x96, white/transparent silhouette

Quickest path: grab a free alarm .wav online or record one, and use any
square logo/emoji-based PNG for the icons — they just need to exist at
those paths for the build to succeed.

## 2. Build it — entirely from Termux

```bash
pkg update && pkg install nodejs git -y
npm install -g eas-cli

cd tentry-alarm-app
npm install

eas login                 # creates a free Expo account if you don't have one
eas build:configure       # links the project, fills in the real projectId
eas build -p android --profile production
```

`eas build` uploads your project and builds the APK **in Expo's cloud** —
your phone/Termux doesn't need to compile anything locally, so this works
fine even on-device. It takes roughly 10–20 minutes. When done, it prints a
download link and QR code — open it on your phone and install the APK
directly (you'll need to allow "install unknown apps" for your browser
once).

## 3. First launch

Open the app. It walks through, one native dialog at a time:

1. Notification permission
2. Alarm channel creation (silent, no dialog — just setup)
3. **DND access** — opens Android's exact settings screen; flip the toggle
   for "Tentry Alarm" (Android won't let any app auto-grant this — it's a
   deliberate security choice, same for every alarm-clock app)
4. Battery optimization exemption — keeps the app alive in background
5. Push token registration — the app shows you a token string

Copy that token into `relay-server/server.js`.

## 4. Set up the relay

See `relay-server/README.md`. Short version: it's the bridge between your
bot's webhook and your phone's push notification. Deploy it anywhere
(Render/Railway free tier is easiest), point your Tentry bot's webhook at
it, done.

## 5. Test end-to-end

```bash
curl -X POST https://<your-relay-host>/webhook/tentry \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: <your secret>" \
  -d '{"symbol":"BTCUSDT","action":"BUY"}'
```

Phone should ring at full volume even in silent mode within a couple
seconds.

## Notes / honest limitations

- Android requires manual DND-access grant — no app, including this one,
  can silently self-grant that. It's a one-time toggle.
- Some phone brands (Xiaomi/MIUI, Huawei, Oppo) have extra aggressive
  battery managers on top of stock Android that can still kill background
  apps. If signals stop arriving after hours idle, check that brand's
  "autostart" / "protected apps" list and add this app there too.
- To update the alarm sound or logic after building, edit the files and
  re-run `eas build` — no laptop needed, same Termux flow each time.

# Tentry Alarm App

Rings like an alarm — through silent/DND mode, at full volume — whenever
your Tentry bot posts a trading signal, instead of at a scheduled time.

**Important:** This app needs a custom dev client, not Expo Go. Expo Go
cannot bypass DND or force alarm-stream audio — those require native config
that only exists in a real build.

## What changed in this rebuild

**The stuck-on-DND bug is fixed.** The old flow fired the DND settings
screen, then — while your phone was still showing that settings screen and
the app was backgrounded — immediately tried to fire the *next* settings
screen (battery optimization) on a timer. Android blocks apps from
launching new screens while backgrounded, so that second launch silently
failed, and the whole step chain stalled with nothing visible happening.

Now: DND and battery steps each show an **"Open Settings"** button and
wait for you to actually come back to the app before a **"Continue"**
button unlocks. Nothing auto-fires while you're not looking at the app.

**Other fixes:**
- `assets/icon.png`, `adaptive-icon.png`, `notification-icon.png`,
  `splash.png` were previously JPEG files mislabeled `.png` with odd
  embedded metadata — replaced with real PNGs.
- The bundled alarm sound was a copyrighted commercial track. Removed —
  ship your own tone or pick one from your phone in-app instead. A
  royalty-free two-tone siren (`assets/alarm_sound.wav`) is now the
  built-in default.
- `app.json`'s notification sound config pointed at `.mp3`, the actual
  notification channel asked for `.wav` — mismatched, so the loud channel
  sound likely wasn't playing at all. Now consistent.
- Relay server: no more manually pasting your push token into `server.js`
  and redeploying every time. The app now registers itself with
  `POST /register`.

## What's in this project

```
Tentry-alarm-app/
├── App.js              → setup flow + full dashboard
├── lib/storage.js       → AsyncStorage helpers
├── app.json             → Android permissions, notification channel config
├── eas.json              → EAS build profiles
├── package.json
├── assets/               → icons, splash, default alarm tone
└── relay-server/          → bot webhook → push notification bridge
```

## 1. Install the new dependency

```bash
npm install
```

(`expo-clipboard` was added for the dashboard's "Copy Token" button.)

## 2. Build — from Termux

```bash
eas build -p android --profile preview
```

Uploads and builds in Expo's cloud — nothing compiles locally. Takes
roughly 10–20 minutes on the free tier (longer if the queue is busy).

## 3. First launch

Same five steps as before, but DND and battery now wait for you:

1. Notification permission (auto)
2. Alarm channel creation (auto, no dialog)
3. **DND access** — tap Open Settings, flip the toggle for "Tentry Alarm",
   go back, tap Continue
4. **Battery optimization** — tap Open Settings, choose "Allow"/"Don't
   optimize", go back, tap Continue
5. Push token registration (auto)

After setup you land on the **Dashboard** — status card, alarm sound
picker with a Test Alarm button, relay connection card, recent signal
history, and settings.

## 4. Connect the relay

1. Deploy `relay-server/` (see its README — Render/Railway free tier is
   easiest).
2. In the Dashboard's Relay Connection card, paste the deployed URL and
   your webhook secret, tap **Save**, then **Register Device**.
3. Point your Tentry bot's webhook at `https://<your-relay>/webhook/tentry`.
4. Tap **Send Test Signal** to confirm the whole chain rings your phone.

## Notes / honest limitations

- Android requires manual DND-access and battery-exemption grants — no
  app can silently self-grant those, and there's no API for the app to
  double check they're still on later. The Dashboard's status card
  reflects what you confirmed during setup, not a live re-check.
- Some phone brands (Xiaomi/MIUI, Huawei, Oppo) have extra aggressive
  battery managers on top of stock Android. If signals stop arriving after
  hours idle, check that brand's "autostart"/"protected apps" list too.
- `tokens.json` on the relay is a flat file — fine for personal use, but
  if your host wipes disk on redeploy you'll need to tap "Register Device"
  again afterward.

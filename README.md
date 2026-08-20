# Tentry Alarm App

Rings like an alarm — through silent/DND mode, at full volume — whenever a trading signal arrives.

**Needs a custom dev client (not Expo Go).**

## Why Expo Push often fails (ColorOS / MIUI / Vivo)

Even with a foreground service, many OEM skins drop data-only Expo/FCM messages when the activity is gone. Expo returns status:ok but the phone never delivers the message to the app. That is an OS limitation.

## Recommended: Signal bridge (v4.5)

While **Monitoring for trading signals** is showing, the app can receive signals without Expo Push:

### 1) ntfy (easiest)

1. Settings → Signal bridge → mode **ntfy**
2. Topic e.g. `tentry-yourname-8291`
3. Save
4. From Entry Bot:

```bash
curl -H "Title: BTCUSDT LONG" \
  -d "entry 65000 SL 64000 TP 67000" \
  https://ntfy.sh/tentry-yourname-8291

# Or JSON (best)
curl -d '{"symbol":"BTCUSDT","action":"LONG","kind":"alarm","entry":"65000","sl":"64000","tp":"67000"}' \
  https://ntfy.sh/tentry-yourname-8291
```

### 2) HTTP poll

Point the app at a URL your bot updates with latest signal JSON.

### 3) Expo Push (optional backup)

Prefer title/body + data. Unreliable on aggressive OEMs when app is closed.

## Build

```bash
eas build --clear-cache -p android --profile production
```

Project ID: f203b829-d914-46fb-b625-94f21233eae0

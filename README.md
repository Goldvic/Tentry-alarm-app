# Tentry Alarm App

Rings like an alarm — through silent/DND mode, at full volume, on top of
whatever app you're in — whenever your Tentry bot posts a trading signal,
instead of at a scheduled time.

**Important:** This app needs a custom dev client, not Expo Go. Expo Go
cannot bypass DND, force alarm-stream audio, or show full-screen alarm
notifications — those all require native config that only exists in a
real build.

---

## v4 — full-screen ringing, forced volume, tabs, custom design

This round is a substantial rebuild, not a patch. Here's what changed and
why, organized so you can see what's solid vs. what genuinely needs
testing on a real device (I can't compile/run Android builds from here,
so everything below is written against documented APIs but hasn't been
compiled).

### What's new

**Full-screen ringing card, like a real alarm clock.** Previously a
signal just fired a notification banner. Now it fires a proper
[notifee](https://notifee.app) full-screen-intent notification — on a
locked or unlocked phone it launches a full-screen card (pulsing icon,
symbol, BUY/SELL, Snooze/Dismiss buttons) on top of whatever you're
doing, not just a banner. Snooze/Dismiss also work as buttons directly
on the lock-screen notification without opening the app, handled by a
background event handler.

**Forced volume, even on silent.** The alarm channel already routed
audio through Android's dedicated ALARM stream (not the ringer/media
streams silent mode mutes) — that was correct in v3. New in v4: the app
now also actively sets that ALARM stream to 100% every time it rings
(via `react-native-volume-manager`), so it's not dependent on whatever
level you last left the alarm stream at. This can be turned off in
Settings > Alarm Behavior if you'd rather set a fixed volume yourself.

**"Display over other apps."** `SYSTEM_ALERT_WINDOW` was declared in
`app.json` in v3 but never actually requested — the permission alone
doesn't do anything without a step asking the user to grant it. Added as
a proper onboarding step and a Settings > Permissions row.

**Tabs.** Home (status + alarm sound + quick test), History (full signal
log), Settings (appearance, alarm behavior, permissions, relay
connection — all customization now lives in one place, as requested).

**Splash screen actually shows now.** v3 already used
`expo-splash-screen` with `preventAutoHideAsync()`, but on a bundle this
small, loading finishes in under a frame — so the splash was hidden
almost instantly and looked like it "never showed." v4 holds it open for
a minimum ~1.4s regardless of how fast loading finishes.

**Adjustable icon/text size.** Settings > Appearance > Display size
(Small/Medium/Large/XL) scales every font size and icon in the app
through one shared `scale()` helper — not just a couple of hardcoded
spots. (Note: this is in-app UI scaling, not the launcher icon file —
your launcher icon/adaptive icon assets were already the correct
1024×1024 size, nothing to fix there.)

**Tailwind, via NativeWind.** `className` styling is used throughout the
new screens/components (`tailwind.config.js`, `babel.config.js`). New
dark "trading terminal" palette with a gradient accent system (5
selectable accent colors in Settings), glass-style cards, and a pulsing
gradient ring on the alarm screen.

**More alarm customization.** Snooze duration, auto-dismiss timeout,
vibration pattern (4 choices including off), volume override toggle —
all in Settings > Alarm Behavior.

**Relay server:** signal payloads now flatten `symbol`/`action`/`message`
into the push notification's `data` field directly (v3 nested them under
`data.payload`), so the ring screen can show the actual symbol and
BUY/SELL instead of a generic "Trading Signal" title.

### Honest limitations — please read before relying on this

- **iOS cannot bypass silent mode** the way Android can. Apple only
  allows this for apps with a Critical Alerts entitlement, which Apple
  grants case-by-case and isn't something this rebuild can turn on by
  itself. On iOS this will behave like a strong time-sensitive
  notification, not a true silent-mode-breaking alarm. Everything
  DND/overlay/battery/full-screen-intent related in this app is
  Android-only by design.
- **Background survival is the biggest unknown.** This app rings off a
  push notification, not a locally scheduled OS alarm — so timing and
  reliability depend on FCM delivery plus Android letting the app wake
  up in time to show the full-screen card and start playback. I
  deliberately did *not* turn the alarm notification into an Android
  foreground service in this round, because getting the Android 14
  foreground-service-type manifest entry wrong can crash the app, and I
  have no way to test that here. If signals stop reliably *ringing*
  (sound/vibration, not just showing a banner) after the phone sits idle
  for hours, that's the next thing to look at — see notifee's
  foreground service docs (notifee.app/react-native/docs/android/foreground-service).
- **`react-native-volume-manager` and `@notifee/react-native` are new
  native dependencies** — they need a real `eas build`, not just a JS
  reload, and I can't guarantee their exact current API surface matches
  what's written here down to the version. If a build fails on either,
  check that package's README for the current method names.
- **NativeWind v2 vs v4:** this project pins NativeWind v2 (simpler,
  babel-only, no Metro config changes needed) which has historically
  targeted slightly older Expo SDKs than 51. If you hit styling/build
  issues specifically traceable to NativeWind, it's the first thing to
  try bumping.
- Same OEM caveat as before: Xiaomi/MIUI, Huawei, Oppo, etc. have extra
  battery managers on top of stock Android — check that brand's
  "autostart"/"protected apps" list too if signals stop arriving after
  hours idle.

### Testing checklist for the first build

1. Splash shows for a beat, not instantly gone.
2. Onboarding walks all 7 Android steps (notifications, channel, DND,
   overlay, battery, full-screen-intent, push token) and resumes at the
   right step if you close/reopen mid-flow.
3. Home > Test Alarm rings at full volume even with the phone physically
   set to silent.
4. Settings > Send Test Signal, with the app foregrounded — full-screen
   card appears with Snooze/Dismiss.
5. Same test with the app backgrounded (home button, not force-closed).
6. Same test with the screen off/phone locked — this is the real test of
   the full-screen intent.
7. Same test with the app fully force-closed — this is the real test of
   background delivery + `getInitialNotification()` cold-start handling.
8. Snooze from the full-screen card, confirm it re-rings after the
   chosen number of minutes.
9. Snooze/Dismiss tapped directly on the lock-screen notification
   (without opening the app) — confirms the background event handler.
10. Settings > Display size — confirm text/icons visibly resize
    everywhere, not just on one screen.

---

## Round 3 — the real Step 5 error, and why it needed Round 2 to show up

The Retry button from Round 2 did its job: it surfaced the actual error
instead of hanging silently. The real cause is unrelated to this app's
code — **push notifications on Android require your own Firebase
project**, and that one-time setup was never done. Without it you'll
always see `Default FirebaseApp is not initialized`. This has to be done
once, outside the code, before rebuilding:

1. Go to the Firebase console (console.firebase.google.com), create
   a project (or reuse one), and add an **Android app** to it with the
   package name `com.tentry.alarmapp` — must match exactly.
2. Download the `google-services.json` it gives you and put it in this
   project's root folder (same level as `app.json`). `app.json` points
   at it (`android.googleServicesFile`) — if the file's missing, `eas build`
   will fail fast with a clear "file not found" instead of a vague
   runtime error, which is easier to debug.
3. In the Firebase console: **Project settings → Service accounts → Generate
   new private key**. This downloads a *different* JSON file — keep it
   private, don't commit it.
4. In Termux, from the project folder: `eas credentials` → Android → your
   build profile → Google Service Account → set up an FCM V1 service account
   key → upload the file from step 3.
5. Rebuild: `eas build -p android --profile preview`.

Both JSON files are already covered by `.gitignore`.

---

## What's in this project

```
Tentry-alarm-app/
├── App.js                    → root: splash gate, onboarding vs tabs, notification wiring
├── app.json                  → Android permissions, notification channel config
├── babel.config.js           → NativeWind (Tailwind) babel plugin
├── tailwind.config.js        → design tokens (colors, accents)
├── context/
│   └── SettingsContext.js    → display size, accent, alarm behavior — persisted
├── lib/
│   ├── storage.js            → AsyncStorage helpers + key registry
│   ├── theme.js               → color/accent/vibration-pattern constants
│   ├── notifications.js       → permission requests + notifee channel/display
│   ├── alarmEngine.js         → forced volume, looping playback, vibration, snooze
│   └── setupSteps.js          → onboarding wizard step definitions
├── components/                → Card, buttons, scaled text/icon, tab bar, rows
├── screens/
│   ├── OnboardingScreen.js
│   ├── HomeScreen.js
│   ├── HistoryScreen.js
│   ├── SettingsScreen.js
│   └── AlarmRingScreen.js     → the full-screen ringing card
├── assets/                    → icons, splash, default alarm tone
└── relay-server/               → bot webhook → push notification bridge
```

## 1. Install dependencies

```bash
npm install
```

This pulls in everything new: `@notifee/react-native`,
`react-native-volume-manager`, `nativewind` + `tailwindcss`,
`expo-linear-gradient`, `expo-haptics`, `@react-native-community/slider`,
`react-native-safe-area-context`. All of these are new native modules or
babel-time tooling — a JS-only reload is **not** enough, you need a fresh
`eas build` after this.

## 2. Build — from Termux

```bash
eas build -p android --profile preview
```

Uploads and builds in Expo's cloud — nothing compiles locally. Takes
roughly 10–20 minutes on the free tier (longer if the queue is busy).

## 3. First launch

Seven steps now (was five):

1. Notification permission (auto)
2. Alarm channel creation (auto, no dialog)
3. **DND access** — tap Open Settings, flip the toggle for "Tentry Alarm",
   go back, tap Continue
4. **Display over other apps** — tap Open Settings, find "Tentry Alarm"
   in the list, allow it, go back, tap Continue
5. **Battery optimization** — tap Open Settings, choose "Allow"/"Don't
   optimize", go back, tap Continue
6. **Full-screen alarm** (Android 14+ only — older Android skips this
   automatically) — tap Open Settings, allow it if the screen appears,
   go back, tap Continue
7. Push token registration (auto)

After setup you land on the **Home** tab.

## 4. Connect the relay

1. Deploy `relay-server/` (see its README — Render/Railway free tier is
   easiest).
2. In Settings > Relay Connection, paste the deployed URL and your
   webhook secret, tap **Save**, then **Register Device**.
3. Point your Tentry bot's webhook at `https://<your-relay>/webhook/tentry`.
4. Tap **Send Test Signal** to confirm the whole chain rings your phone —
   run through the testing checklist above, especially locked-screen and
   force-closed scenarios.

## Notes / honest limitations (carried over from earlier rounds)

- Android requires manual DND/overlay/battery grants — no app can
  silently self-grant those, and there's no API for the app to double
  check they're still on later. The Home/Settings status rows reflect
  what you confirmed during setup, not a live re-check.
- `tokens.json` on the relay is a flat file — fine for personal use, but
  if your host wipes disk on redeploy you'll need to tap "Register
  Device" again afterward.

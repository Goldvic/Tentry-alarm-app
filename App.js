import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, AppState, Alert, Linking, Image, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as DocumentPicker from 'expo-document-picker';
import * as SplashScreen from 'expo-splash-screen';
import notifee, { EventType } from '@notifee/react-native';

import { SettingsProvider, useSettings } from './context/SettingsContext';
import {
  KEYS, getJSON, getString, setJSON,
  pushSignalHistory, pushAlarmHistory, pushNotificationLog,
} from './lib/storage';
import {
  createAlarmChannel, requestNotificationPermissions, getNotificationPermissionStatus,
  presentAlarmNotification, buildSignalText, extractPushPayload,
  startMonitoringService,
} from './lib/notifications';
import { startRinging, stopRinging, snoozeRinging, ringImmediately, isRingingNow, getCurrentRingMeta } from './lib/alarmEngine';
import { buildSteps } from './lib/setupSteps';
import { launchAppOverlay } from './lib/overlayLauncher';
import { setSignalHandler, startSignalBridge } from './lib/signalBridge';

import ErrorBoundary from './components/ErrorBoundary';
import TabBar from './components/TabBar';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import SignalsScreen from './screens/SignalsScreen';
import ActivityScreen from './screens/ActivityScreen';
import CalculatorScreen from './screens/CalculatorScreen';
import SettingsScreen from './screens/SettingsScreen';
import AlarmRingScreen from './screens/AlarmRingScreen';

SplashScreen.preventAutoHideAsync().catch(() => {});
const MIN_SPLASH_MS = 2000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MONITORING_ID = 'tentry-monitoring';

/** True for the silent keep-alive notification — must never log or ring. */
function isMonitoringNoise(title, body, data = {}, id) {
  const d = data || {};
  const t = String(title || '');
  const b = String(body || '');
  if (d.kind === 'monitoring') return true;
  if (id === 'tentry-monitoring' || id === MONITORING_ID) return true;
  if (t === 'Tentry Alarm' && b.toLowerCase().includes('monitoring')) return true;
  if (b === 'Monitoring for trading signals') return true;
  return false;
}

/** Real trading signal? Empty / noise payloads must not create history or alarms. */
function isRealSignal(data = {}, title, body) {
  if (isMonitoringNoise(title, body, data)) return false;
  if (data.kind === 'alarm') return true;
  if (data.symbol || data.action || data.entry || data.entry_price) return true;
  return false;
}


try {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.ACTION_PRESS || type === EventType.PRESS) {
      const actionId = detail.pressAction?.id;
      const n = detail.notification || {};
      const data = n.data || {};
      // Never treat Monitoring tap as an alarm action
      if (
        actionId === 'open-monitoring' ||
        isMonitoringNoise(n.title, n.body, data, n.id)
      ) {
        return;
      }
      if (actionId === 'dismiss') {
        try {
          const { setJSON, KEYS: K } = require('./lib/storage');
          await setJSON(K.ACTIVE_ALARM, null);
        } catch (_) {}
        await stopRinging(true);
      } else if (actionId === 'snooze') {
        const minutes = (await getJSON(KEYS.SNOOZE_MINUTES, 5)) || 5;
        const data = detail.notification?.data || {};
        await snoozeRinging({
          minutes,
          title: data.symbol || detail.notification?.title,
          body: detail.notification?.body,
          data,
        });
      }
    }
  });
} catch (e) {
  console.error('notifee background handler failed:', e);
}

// Runs when a push arrives while the app is backgrounded or fully killed (Android).
// This is what makes the alarm fire WITHOUT the user having to open the app first —
// it posts the full-screen, looping-sound notifee alarm from a headless JS context.
// Must stay at module scope (not inside RootApp) so it registers on every JS load,
// including headless background launches (and while the keep-alive FGS is the only
// thing keeping the process alive after swipe-from-Recents).
const BACKGROUND_NOTIFICATION_TASK = 'TENTRY_BACKGROUND_NOTIFICATION_TASK';

/**
 * Shared headless path used by the background task AND any other entry that
 * receives a remote push while no React tree is mounted (FGS-only process).
 * Always posts the notifee full-screen alarm + tries overlay auto-launch.
 */
async function handleRemotePushHeadless(raw) {
  console.log('[Tentry] headless push raw:', JSON.stringify(raw)?.slice?.(0, 2000));

  const notification = raw?.notification || raw || {};
  const content = notification.request?.content || notification || {};
  const explicitTitle =
    content.title ||
    notification.title ||
    raw?.title ||
    null;
  const explicitBody =
    content.body ||
    notification.body ||
    raw?.body ||
    null;
  const payloadData =
    extractPushPayload(raw) ||
    extractPushPayload(notification) ||
    extractPushPayload(content) ||
    extractPushPayload(content.data) ||
    {};

  // Ignore pure monitoring / non-signal noise
  if (
    payloadData.kind === 'monitoring' ||
    (explicitTitle === 'Tentry Alarm' &&
      String(explicitBody || '').includes('Monitoring'))
  ) {
    return;
  }

  const { title, body } = buildSignalText({
    title: explicitTitle,
    body: explicitBody,
    data: payloadData,
  });
  await createAlarmChannel();
  await presentAlarmNotification({ title, body, data: payloadData });
  // Best-effort: if "Display over other apps" is granted, bring the app to
  // the foreground instead of waiting for a notification tap.
  await launchAppOverlay();
}

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[Tentry] background notification task error:', error);
    return;
  }
  try {
    await handleRemotePushHeadless(data);
  } catch (e) {
    console.error('[Tentry] background task failed to display alarm:', e);
  }
});

Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch((e) => {
  console.warn('[Tentry] Failed to register background notification task:', e);
});

function RootApp() {
  const settings = useSettings();
  const [booting, setBooting] = useState(true);
  const [splashError, setSplashError] = useState(null);
  const [phase, setPhase] = useState('onboarding');
  const [tab, setTab] = useState('home');

  const [results, setResults] = useState({});
  const [pushToken, setPushToken] = useState(null);
  const [notifGranted, setNotifGranted] = useState(false);

  const [lastSignal, setLastSignal] = useState(null);
  const [alarmUri, setAlarmUri] = useState(null);
  const [alarmName, setAlarmName] = useState(null);
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);

  const [signalHistory, setSignalHistory] = useState([]);
  const [alarmHistory, setAlarmHistory] = useState([]);
  const [notificationLog, setNotificationLog] = useState([]);

  const [ringVisible, setRingVisible] = useState(false);
  const [ringSignal, setRingSignal] = useState(null);

  const appState = useRef(AppState.currentState);
  const stepsRef = useRef(buildSteps({ onPushToken: setPushToken }));
  const autoDismissTimer = useRef(null);
  const startTickingRef = useRef(null);
  const alarmUriRef = useRef(null);
  // While true, ignore notifee's DELIVERED event — it fires every time we (re)post
  // the alarm notification, including reposts WE trigger, which otherwise causes an
  // infinite display -> DELIVERED -> display loop (this was the "100 notifications" bug).
  const suppressDeliveredRef = useRef(false);

  useEffect(() => {
    alarmUriRef.current = alarmUri;
  }, [alarmUri]);

  const logEverything = useCallback(async (title, body, dataPayload = {}) => {
    const logEntry = {
      title: title || 'Notification',
      body: body || '',
      message: body || '',
      data: dataPayload,
      kind: 'signal',
      isSignal: true,
      time: new Date().toLocaleString(),
      timestamp: Date.now(),
    };
    const nextLog = await pushNotificationLog(logEntry);
    setNotificationLog(nextLog);

    setLastSignal(body || title);
    const signalEntry = {
      message: body || title,
      body,
      title,
      data: dataPayload,
      symbol: dataPayload.symbol,
      action: dataPayload.action,
      entry: dataPayload.entry,
      tp: dataPayload.tp || dataPayload.takeProfit,
      sl: dataPayload.sl || dataPayload.stopLoss,
      time: new Date().toLocaleTimeString(),
      timestamp: Date.now(),
    };
    const nextSignals = await pushSignalHistory(signalEntry);
    setSignalHistory(nextSignals);
    return signalEntry;
  }, []);

  const lastTickKeyRef = useRef('');
  const startTicking = useCallback(
    async (signalPayload, notifBody) => {
      const payload = signalPayload || {};
      // One ring at a time — ignore duplicate startTicking for same content
      const tickKey = [
        payload._fp || payload._signalId || '',
        payload.symbol || '',
        payload.action || '',
        payload.entry || '',
        payload.sl || '',
        payload.tp || '',
      ].join('|');
      if (isRingingNow() && tickKey && tickKey === lastTickKeyRef.current) {
        setRingVisible(true);
        setIsAlarmPlaying(true);
        return;
      }
      if (isRingingNow()) {
        // Already ringing a different/same alarm — just show card, don't restart audio/history
        setRingSignal(payload);
        setRingVisible(true);
        setIsAlarmPlaying(true);
        return;
      }
      lastTickKeyRef.current = tickKey;

      setRingSignal(payload);
      setRingVisible(true);

      try {
        await setJSON(KEYS.ACTIVE_ALARM, {
          ...payload,
          message: notifBody || payload.message || '',
          body: notifBody || payload.message || '',
          savedAt: Date.now(),
        });
      } catch (_) {}

      await startRinging({
        soundUri: alarmUriRef.current,
        forceMaxVolume: settings.forceMaxVolume,
        alarmVolume: settings.alarmVolume,
        vibrationPattern: settings.vibrationPattern,
        meta: { title: payload.symbol, body: notifBody || payload.message, data: payload },
      });
      setIsAlarmPlaying(true);

      const entry = {
        title: payload.symbol || 'Signal',
        symbol: payload.symbol,
        action: payload.action,
        message: notifBody || payload.message || '',
        timestamp: Date.now(),
        timeLabel: new Date().toLocaleTimeString(),
      };
      const nextAlarm = await pushAlarmHistory(entry);
      setAlarmHistory(nextAlarm);

      if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
      if (settings.autoDismissMinutes > 0) {
        autoDismissTimer.current = setTimeout(() => handleDismiss(), settings.autoDismissMinutes * 60 * 1000);
      }
    },
    [settings.forceMaxVolume, settings.alarmVolume, settings.vibrationPattern, settings.autoDismissMinutes]
  );
  startTickingRef.current = startTicking;

  // Bridge (ntfy / HTTP poll) → full alarm path. Runs while FGS keeps JS alive.
  useEffect(() => {
    setSignalHandler(async ({ title, body, data }) => {
      try {
        suppressDeliveredRef.current = true;
        // Log once — bridge already deduped by id/fingerprint
        await logEverything(title, body, data || {});

        // Ring only — no tray notification
        try {
          await launchAppOverlay();
        } catch (_) {}

        try {
          startTickingRef.current?.(
            {
              symbol: data?.symbol,
              action: data?.action,
              message: body,
              ...(data || {}),
            },
            body
          );
        } catch (_) {}

        setTimeout(() => { launchAppOverlay().catch(() => {}); }, 800);
        setTimeout(() => { suppressDeliveredRef.current = false; }, 5000);
      } catch (e) {
        console.error('[Tentry] bridge handler failed', e);
        suppressDeliveredRef.current = false;
      }
    });
    startSignalBridge();
  }, [logEverything]);


  const handleDismiss = useCallback(async () => {
    if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
    // Clear persisted active alarm FIRST so recoverAlarmFromOS cannot re-start audio
    try { await setJSON(KEYS.ACTIVE_ALARM, null); } catch (_) {}
    // Fully stop audio + cancel every alarm tray / snooze trigger (notifee + expo)
    // Monitoring FGS is re-posted silently by stopAlarmNotification
    await stopRinging(true);
    setIsAlarmPlaying(false);
    setRingVisible(false);
    setRingSignal(null);
    // Prevent recoverAlarmFromOS / DELIVERED from re-starting audio on next focus
    suppressDeliveredRef.current = true;
    setTimeout(() => { suppressDeliveredRef.current = false; }, 3000);
  }, []);

  const handleSnooze = useCallback(async () => {
    if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
    await snoozeRinging({
      minutes: settings.snoozeMinutes,
      title: ringSignal?.symbol,
      body: ringSignal?.message,
      data: ringSignal || {},
    });
    setIsAlarmPlaying(false);
    setRingVisible(false);
    setRingSignal(null);
    try { await setJSON(KEYS.ACTIVE_ALARM, null); } catch (_) {}
  }, [settings.snoozeMinutes, ringSignal]);

  /** Restore alarm CARD + audio when Activity comes back (swipe-kill, cold start, etc.) */
  const recoverAlarmFromOS = useCallback(async () => {
    try {
      const isMonitoringNotif = (n) => {
        if (!n) return false;
        const data = n.data || {};
        return (
          data.kind === 'monitoring' ||
          n.id === 'tentry-monitoring' ||
          (n.title === 'Tentry Alarm' && String(n.body || '').includes('Monitoring'))
        );
      };

      // 0) Active alarm persisted while FGS was ringing with no UI
      const saved = await getJSON(KEYS.ACTIVE_ALARM, null);
      if (saved && (saved.symbol || saved.action || saved.message)) {
        const body = saved.body || saved.message || '';
        setRingSignal(saved);
        setRingVisible(true);
        setIsAlarmPlaying(true);
        if (!isRingingNow()) {
          suppressDeliveredRef.current = true;
          await ringImmediately({
            title: saved.symbol || 'Trading Signal',
            body,
            data: saved,
          });
          startTickingRef.current?.(
            { symbol: saved.symbol, action: saved.action, message: body, ...saved },
            body
          );
          setTimeout(() => { suppressDeliveredRef.current = false; }, 4000);
        }
        return;
      }

      // Sound already looping in JS but card was never mounted
      if (isRingingNow()) {
        const meta = getCurrentRingMeta?.() || {};
        const data = meta.data || meta || {};
        if (data.symbol || data.action || meta.title) {
          setRingSignal({
            symbol: data.symbol || meta.title,
            action: data.action,
            message: meta.body || data.message,
            ...data,
          });
        }
        setRingVisible(true);
        setIsAlarmPlaying(true);
      }

      // 1) notifee cold start (user opened from a notification)
      const initial = await notifee.getInitialNotification();
      if (initial?.notification) {
        const n = initial.notification;
        if (isMonitoringNotif(n)) return; // silent keep-alive: never alarm
        const data = n.data || {};
        if (data.kind !== 'alarm' && !data.symbol && !data.action) return;
        await logEverything(n.title, n.body, data);
        if (!isRingingNow()) {
          suppressDeliveredRef.current = true;
          await ringImmediately({ title: n.title, body: n.body, data });
          startTickingRef.current?.(
            { symbol: data.symbol, action: data.action, message: n.body, ...data },
            n.body
          );
          setTimeout(() => { suppressDeliveredRef.current = false; }, 4000);
        } else {
          setRingSignal({ symbol: data.symbol, action: data.action, message: n.body, ...data });
          setRingVisible(true);
          setIsAlarmPlaying(true);
        }
        return;
      }

      // 2) Expo last response (user tapped system notification) — never monitoring
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last?.notification) {
        const c = last.notification.request.content || {};
        const data = c.data || {};
        if (
          data.kind === 'monitoring' ||
          (c.title === 'Tentry Alarm' && String(c.body || '').includes('Monitoring'))
        ) {
          return;
        }
        if (data.kind !== 'alarm' && !data.symbol && !data.action) return;
        await logEverything(c.title, c.body, data);
        if (!isRingingNow()) {
          suppressDeliveredRef.current = true;
          await ringImmediately({ title: c.title, body: c.body, data });
          startTickingRef.current?.(
            { symbol: data.symbol, action: data.action, message: c.body, ...data },
            c.body
          );
          setTimeout(() => { suppressDeliveredRef.current = false; }, 4000);
        } else {
          setRingSignal({ symbol: data.symbol, action: data.action, message: c.body, ...data });
          setRingVisible(true);
          setIsAlarmPlaying(true);
        }
        return;
      }

      // 3) Any still-displayed ALARM notifications (ignore monitoring)
      const displayed = await notifee.getDisplayedNotifications();
      const alarm = displayed.find((d) => {
        const n = d.notification;
        if (!n || isMonitoringNotif(n)) return false;
        return n.data?.kind === 'alarm' || n.id === 'tentry-active-alarm';
      });
      if (alarm?.notification) {
        const n = alarm.notification;
        const data = n.data || {};
        setRingSignal({ symbol: data.symbol, action: data.action, message: n.body, ...data });
        setRingVisible(true);
        setIsAlarmPlaying(true);
        if (!isRingingNow()) {
          startTickingRef.current?.(
            { symbol: data.symbol, action: data.action, message: n.body, ...data },
            n.body
          );
        }
      }
    } catch (e) {
      console.warn('recoverAlarmFromOS', e);
    }
  }, [logEverything]);

  // Boot
  useEffect(() => {
    (async () => {
      const loadWork = (async () => {
        await createAlarmChannel();
        // System permission dialogs — no manual Settings trip for notifications
        try { await requestNotificationPermissions(); } catch (_) {}
        const savedAlarm = await getJSON(KEYS.ALARM_URI, null);
        if (savedAlarm) {
          setAlarmUri(savedAlarm.uri);
          alarmUriRef.current = savedAlarm.uri;
          setAlarmName(savedAlarm.name);
        }
        const savedToken = await getString(KEYS.PUSH_TOKEN, '');
        if (savedToken) setPushToken(savedToken);

        const savedResults = await getJSON(KEYS.SETUP_RESULTS, null);
        const steps = stepsRef.current;
        if (savedResults) {
          setResults(savedResults);
          const allOk = steps.every((s) => savedResults[s.key]);
          setPhase(allOk && savedToken ? 'main' : 'onboarding');
        } else {
          setPhase('onboarding');
        }

        setSignalHistory((await getJSON(KEYS.SIGNAL_HISTORY, [])) || []);
        setAlarmHistory((await getJSON(KEYS.ALARM_HISTORY, [])) || []);
        setNotificationLog((await getJSON(KEYS.NOTIFICATION_LOG, [])) || []);
        setNotifGranted(await getNotificationPermissionStatus());

        await recoverAlarmFromOS();

        // If setup was already completed and no alarm is currently ringing,
        // start the permanent keep-alive Foreground Service so the process
        // survives swipe-from-Recents.
        if (savedResults && !isRingingNow()) {
          const allOk = steps.every((s) => savedResults[s.key]);
          if (allOk && savedToken) {
            startMonitoringService().catch(() => {});
          }
        }
      })();

      try {
        await Promise.all([loadWork, delay(MIN_SPLASH_MS)]);
      } catch (e) {
        console.error('Boot failed:', e);
        setPhase('onboarding');
      } finally {
        setBooting(false);
        await SplashScreen.hideAsync().catch(() => {});
      }
    })();
  }, []);

  // Resume from background / after swipe-kill relaunch
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const cameBack = appState.current.match(/inactive|background/) && next === 'active';
      appState.current = next;
      if (cameBack) {
        setNotifGranted(await getNotificationPermissionStatus());
        // Always try restore alarm CARD (sound may already be on with no UI)
        await recoverAlarmFromOS();
        if (isRingingNow()) {
          setRingVisible(true);
          setIsAlarmPlaying(true);
        }
        // Re-assert keep-alive only when not in an active alarm
        if (phase === 'main' && !isRingingNow()) {
          startMonitoringService().catch(() => {});
        }
      }
    });
    return () => sub.remove();
  }, [recoverAlarmFromOS, phase]);

  // Foreground / process-alive push (also fires when keep-alive FGS holds the
  // JS process after swipe-from-Recents, as long as the React tree is mounted).
  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener(async (notification) => {
      try {
        console.log('[Tentry] received push:', JSON.stringify(notification)?.slice?.(0, 1500));
        const content = notification.request?.content || notification.content || {};
        // Data-only Expo pushes sometimes put fields only under content.data,
        // sometimes nested / stringified — walk the whole object aggressively.
        const dataPayload =
          extractPushPayload(content.data) ||
          extractPushPayload(content) ||
          extractPushPayload(notification.request) ||
          extractPushPayload(notification) ||
          (typeof content.data === 'object' ? content.data : null) ||
          {};

        if (isMonitoringNoise(content.title, content.body, dataPayload)) return;
        if (!isRealSignal(dataPayload, content.title, content.body)) return;

        const { title, body } = buildSignalText({
          title: content.title || null,
          body: content.body || null,
          data: dataPayload,
        });

        // If already ringing, do not log/ring again (duplicate push delivery)
        if (isRingingNow()) {
          setRingVisible(true);
          setIsAlarmPlaying(true);
          return;
        }

        suppressDeliveredRef.current = true;
        await logEverything(title, body, dataPayload);

        try {
          startTickingRef.current?.(
            {
              symbol: dataPayload.symbol,
              action: dataPayload.action,
              message: body,
              ...dataPayload,
            },
            body
          );
        } catch (tickErr) {
          console.error('[Tentry] startTicking failed', tickErr);
        }

        // No tray notification — ring only
        await launchAppOverlay();
        setTimeout(() => { suppressDeliveredRef.current = false; }, 5000);
      } catch (e) {
        console.error('[Tentry] Push handler error', e);
        suppressDeliveredRef.current = false;
      }
    });
    return () => receivedSub.remove();
  }, [logEverything]);

  useEffect(() => {
    const responseSub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      try {
        const content = response.notification.request.content || {};
        const data = content.data || {};
        const title = content.title;
        const body = content.body;
        // Tapping Monitoring (or any non-signal) must do nothing
        if (isMonitoringNoise(title, body, data)) return;
        if (!isRealSignal(data, title, body)) return;

        // Tap on existing alarm notification: only show card / open app — no new ring
        if (isRingingNow() || data.tentry_alarm === '1' || data.kind === 'alarm') {
          const built = buildSignalText({ title, body, data });
          setRingSignal({ symbol: data.symbol, action: data.action, message: built.body, ...data });
          setRingVisible(true);
          setIsAlarmPlaying(true);
          if (!isRingingNow()) {
            startTickingRef.current?.(
              { symbol: data.symbol, action: data.action, message: built.body, ...data },
              built.body
            );
          }
          return;
        }
      } catch (e) {
        console.error('[Tentry] Response handler error', e);
      }
    });
    return () => responseSub.remove();
  }, [logEverything]);

  useEffect(() => {
    const unsub = notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type === EventType.ACTION_PRESS) {
        const id = detail.pressAction?.id;
        if (id === 'dismiss') handleDismiss();
        if (id === 'snooze') handleSnooze();
      } else if (type === EventType.PRESS) {
        const data = detail.notification?.data || {};
        const actionId = detail.pressAction?.id;
        const title = detail.notification?.title || '';
        const body = detail.notification?.body || '';
        const nid = detail.notification?.id;
        // Silent keep-alive / anything that is not a real alarm: do nothing
        if (
          actionId === 'open-monitoring' ||
          isMonitoringNoise(title, body, data, nid) ||
          !isRealSignal(data, title, body)
        ) {
          return;
        }
        // Real alarm notification: show card only (do not start a second ring if already on)
        if (data.kind === 'alarm' || nid === 'tentry-active-alarm') {
          setRingSignal({ symbol: data.symbol, action: data.action, message: body, ...data });
          setRingVisible(true);
          setIsAlarmPlaying(true);
          if (!isRingingNow()) {
            startTickingRef.current?.(data, body);
          }
        }
      } else if (type === EventType.DELIVERED) {
        // Monitoring or any local post — never start a second ring from DELIVERED.
        // Signal path is ring-only (no alarm tray), so this must stay a no-op.
        return;
      }
    });
    return () => unsub();
  }, [handleDismiss, handleSnooze, ringVisible, logEverything]);

  const onClearAlarmHistory = async () => {
    await setJSON(KEYS.ALARM_HISTORY, []);
    setAlarmHistory([]);
  };

  const pickAlarmSong = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets[0];
    setAlarmUri(file.uri);
    alarmUriRef.current = file.uri;
    setAlarmName(file.name);
    await setJSON(KEYS.ALARM_URI, { uri: file.uri, name: file.name });
  };

  const onTestAlarm = () => {
    startTicking({ symbol: 'TEST', action: 'BUY', message: 'This is a test alarm' }, 'Test alarm');
  };

  const onFixNotifications = async () => {
    const granted = await requestNotificationPermissions();
    setNotifGranted(granted);
    if (!granted) {
      Alert.alert('Still blocked', 'Open Settings → Apps → Tentry Alarm → Notifications.', [
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
        { text: 'Cancel' },
      ]);
    }
  };

  const onRerunSetup = () => setPhase('onboarding');
  const onFixStep = async (key) => {
    const current = (await getJSON(KEYS.SETUP_RESULTS, {})) || {};
    const next = { ...current, [key]: false };
    await setJSON(KEYS.SETUP_RESULTS, next);
    setResults(next);
    setPhase('onboarding');
  };
  const onOnboardingComplete = async () => {
    setResults((await getJSON(KEYS.SETUP_RESULTS, null)) || {});
    setPhase('main');
    // Start permanent Foreground Service as soon as setup is finished so
    // the process stays alive after the user leaves the app.
    startMonitoringService().catch(() => {});
    startSignalBridge();
  };

  const alarmsToday = (() => {
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return (alarmHistory || []).filter((a) => {
      const ts = a.timestamp || a.time;
      if (!ts) return false;
      const d = new Date(typeof ts === 'number' ? ts : Date.parse(ts));
      if (isNaN(d.getTime())) return false;
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return k === key;
    }).length;
  })();

  if (booting) {
    return (
      <View style={styles.splash}>
        <Image
          source={require('./assets/splash.png')}
          style={styles.splashImg}
          resizeMode="contain"
          onError={(e) => setSplashError(String(e?.nativeEvent?.error || 'image load failed'))}
          onLoad={() => setSplashError(null)}
        />
        {splashError ? (
          <Text style={styles.splashErr}>
            Splash image failed: {splashError}{'\n'}
            Using dark fallback. Rebuild native app if this persists.
          </Text>
        ) : null}
        <Text style={styles.splashBrand}>TENTRY</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#05070d' }}>
      <StatusBar style="light" />
      {phase === 'onboarding' ? (
        <OnboardingScreen onComplete={onOnboardingComplete} onPushToken={setPushToken} />
      ) : (
        <View style={{ flex: 1 }}>
          {tab === 'home' && (
            <HomeScreen
              results={results}
              pushToken={pushToken}
              notifGranted={notifGranted}
              alarmName={alarmName}
              onPickSong={pickAlarmSong}
              onTestAlarm={onTestAlarm}
              onStopAlarm={handleDismiss}
              isAlarmPlaying={isAlarmPlaying}
              lastSignal={lastSignal}
              recentSignals={signalHistory}
              alarmsToday={alarmsToday}
              onFixNotifications={onFixNotifications}
              onFixStep={onFixStep}
            />
          )}
          {tab === 'signals' && <SignalsScreen signals={signalHistory} />}
          {tab === 'calculator' && <CalculatorScreen />}
          {tab === 'history' && (
            <ActivityScreen
              alarmHistory={alarmHistory}
              notificationLog={notificationLog}
              onClearHistory={onClearAlarmHistory}
            />
          )}
          {tab === 'settings' && (
            <SettingsScreen
              results={results}
              notifGranted={notifGranted}
              onFixNotifications={onFixNotifications}
              onFixStep={onFixStep}
              onRerunSetup={onRerunSetup}
              pushToken={pushToken}
              onTestAlarm={onTestAlarm}
              onPickSong={pickAlarmSong}
              alarmName={alarmName}
            />
          )}
          <TabBar active={tab} onChange={setTab} />
        </View>
      )}
      <AlarmRingScreen
        visible={ringVisible}
        signal={ringSignal}
        onSnooze={handleSnooze}
        onDismiss={handleDismiss}
        snoozeMinutes={settings.snoozeMinutes}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#05070d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashImg: { width: 240, height: 240 },
  splashBrand: {
    marginTop: 16,
    color: '#5c6488',
    fontSize: 12,
    letterSpacing: 4,
    fontWeight: '700',
  },
  splashErr: {
    marginTop: 12,
    marginHorizontal: 24,
    color: '#ffb020',
    fontSize: 11,
    textAlign: 'center',
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <SettingsProvider>
          <RootApp />
        </SettingsProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

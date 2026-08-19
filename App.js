import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, AppState, Alert, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as DocumentPicker from 'expo-document-picker';
import * as SplashScreen from 'expo-splash-screen';
import notifee, { EventType } from '@notifee/react-native';

import { SettingsProvider, useSettings } from './context/SettingsContext';
import { KEYS, getJSON, getString, setJSON, setString, pushSignalHistory } from './lib/storage';
import { createAlarmChannel, requestNotificationPermissions, getNotificationPermissionStatus } from './lib/notifications';
import { startRinging, stopRinging, snoozeRinging, ringImmediately } from './lib/alarmEngine';
import { buildSteps } from './lib/setupSteps';

import ErrorBoundary from './components/ErrorBoundary';
import TabBar from './components/TabBar';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import HistoryScreen from './screens/HistoryScreen';
import SettingsScreen from './screens/SettingsScreen';
import AlarmRingScreen from './screens/AlarmRingScreen';

// Keep the native splash up until we've both finished loading saved state
// AND a minimum time has passed — a small bundle like this can finish
// loading in a single frame, which is what made the splash look like it
// "never showed" before: it was hidden almost instantly. Holding it open
// for a beat makes it actually visible every launch.
SplashScreen.preventAutoHideAsync().catch(() => {});
const MIN_SPLASH_MS = 1400;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Registered at module scope (runs as soon as the JS bundle loads, even
// if the app was fully killed) — this is what lets Snooze/Dismiss on the
// lock-screen notification work without the user ever opening the app.
//
// Wrapped in try/catch: this runs before React mounts anything, so if
// notifee's native side isn't linked yet on a given device/build, an
// uncaught throw here used to kill the whole bundle with nothing on
// screen but a blank white window. Now it just logs and the rest of the
// app still boots normally.
try {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.ACTION_PRESS || type === EventType.PRESS) {
      const actionId = detail.pressAction?.id;
      if (actionId === 'dismiss') {
        await stopRinging();
      } else if (actionId === 'snooze') {
        const minutes = (await getJSON(KEYS.SNOOZE_MINUTES, 5)) || 5;
        const data = detail.notification?.data || {};
        await snoozeRinging({ minutes, title: data.symbol, body: detail.notification?.body, data });
      } else if (type === EventType.DISMISSED) {
        // swipe-dismissed — leave sound/vibration running only if it was a
        // real ring (Android lets ongoing alarm notifications resist swipe
        // dismissal already; this is a safety net for OEMs that don't).
      }
    }
  });
} catch (e) {
  console.error('Failed to register notifee background handler:', e);
}

function RootApp() {
  const settings = useSettings();
  const [booting, setBooting] = useState(true);
  const [phase, setPhase] = useState('onboarding'); // 'onboarding' | 'main'
  const [tab, setTab] = useState('home');

  const [results, setResults] = useState({});
  const [pushToken, setPushToken] = useState(null);
  const [notifGranted, setNotifGranted] = useState(false);

  const [lastSignal, setLastSignal] = useState(null);
  const [alarmUri, setAlarmUri] = useState(null);
  const [alarmName, setAlarmName] = useState(null);
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);

  const [history, setHistory] = useState([]);
  const [relayUrl, setRelayUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [registering, setRegistering] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const [ringVisible, setRingVisible] = useState(false);
  const [ringSignal, setRingSignal] = useState(null);

  const appState = useRef(AppState.currentState);
  const stepsRef = useRef(buildSteps({ onPushToken: setPushToken }));
  const autoDismissTimer = useRef(null);

  const startTicking = useCallback(
    (signalPayload, notifBody) => {
      setRingSignal(signalPayload);
      setRingVisible(true);
      startRinging({
        soundUri: alarmUri,
        forceMaxVolume: settings.forceMaxVolume,
        alarmVolume: settings.alarmVolume,
        vibrationPattern: settings.vibrationPattern,
      });
      setIsAlarmPlaying(true);

      if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
      if (settings.autoDismissMinutes > 0) {
        autoDismissTimer.current = setTimeout(() => {
          handleDismiss();
        }, settings.autoDismissMinutes * 60 * 1000);
      }
    },
    [alarmUri, settings.forceMaxVolume, settings.alarmVolume, settings.vibrationPattern, settings.autoDismissMinutes]
  );

  const handleDismiss = useCallback(async () => {
    if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
    await stopRinging();
    setIsAlarmPlaying(false);
    setRingVisible(false);
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
  }, [settings.snoozeMinutes, ringSignal]);

  // ---- Boot sequence ----
  useEffect(() => {
    (async () => {
      const loadWork = (async () => {
        await createAlarmChannel();

        const savedAlarm = await getJSON(KEYS.ALARM_URI, null);
        if (savedAlarm) {
          setAlarmUri(savedAlarm.uri);
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

        setHistory((await getJSON(KEYS.SIGNAL_HISTORY, [])) || []);
        setRelayUrl(await getString(KEYS.RELAY_URL, ''));
        setWebhookSecret(await getString(KEYS.WEBHOOK_SECRET, ''));

        const granted = await getNotificationPermissionStatus();
        setNotifGranted(granted);

        // Cold start from tapping a full-screen alarm notification (app
        // was fully killed) — jump straight into the ring screen instead
        // of showing the dashboard first.
        const initial = await notifee.getInitialNotification();
        if (initial?.notification?.data?.kind === 'alarm') {
          startTicking(initial.notification.data, initial.notification.body);
        }
      })();

      try {
        await Promise.all([loadWork, delay(MIN_SPLASH_MS)]);
      } catch (e) {
        // A single failed step in loadWork (a storage read, notifee, etc.)
        // used to reject here and skip everything below — setBooting(false)
        // and SplashScreen.hideAsync() never ran, so the app stayed stuck
        // on the boot screen forever. Now we log it and still fall through
        // to onboarding so the app always becomes visible and usable.
        console.error('Boot sequence failed:', e);
        setPhase('onboarding');
      } finally {
        setBooting(false);
        await SplashScreen.hideAsync().catch(() => {});
      }
    })();
  }, []);

  // ---- Foreground app-state / notification-permission re-check ----
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const cameBack = appState.current.match(/inactive|background/) && next === 'active';
      appState.current = next;
      if (cameBack) {
        setNotifGranted(await getNotificationPermissionStatus());
      }
    });
    return () => sub.remove();
  }, []);

  // ---- Incoming push notifications (foreground) ----
  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener(async (notification) => {
      const body = notification.request.content.body || 'Signal received';
      const dataPayload = notification.request.content.data || {};
      setLastSignal(body);
      const entry = { message: body, time: new Date().toLocaleTimeString() };
      const next = await pushSignalHistory(entry);
      setHistory(next);
      await ringImmediately({ title: dataPayload.symbol || 'Trading Signal', body, data: dataPayload });
      startTicking({ symbol: dataPayload.symbol, action: dataPayload.action, message: body }, body);
    });
    return () => receivedSub.remove();
  }, [startTicking]);

  // ---- notifee foreground events: tapping Snooze/Dismiss while the app
  // is open, or tapping the notification itself ----
  useEffect(() => {
    const unsub = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.ACTION_PRESS) {
        const id = detail.pressAction?.id;
        if (id === 'dismiss') handleDismiss();
        if (id === 'snooze') handleSnooze();
      } else if (type === EventType.PRESS) {
        const data = detail.notification?.data;
        if (data?.kind === 'alarm' && !ringVisible) {
          startTicking(data, detail.notification?.body);
        }
      }
    });
    return () => unsub();
  }, [handleDismiss, handleSnooze, ringVisible, startTicking]);

  // ---- Relay actions ----
  const onSaveRelay = async () => {
    await setString(KEYS.RELAY_URL, relayUrl.trim());
    await setString(KEYS.WEBHOOK_SECRET, webhookSecret);
    Alert.alert('Saved', 'Relay settings saved on this device.');
  };

  const onRegisterToken = async () => {
    if (!relayUrl || !pushToken) return;
    setRegistering(true);
    try {
      const resp = await fetch(`${relayUrl.replace(/\/$/, '')}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: pushToken }),
      });
      if (!resp.ok) throw new Error(`Server responded ${resp.status}`);
      Alert.alert('Registered', 'This device is now registered with your relay server.');
    } catch (e) {
      Alert.alert('Registration failed', String(e.message || e));
    } finally {
      setRegistering(false);
    }
  };

  const onSendTestSignal = async () => {
    if (!relayUrl) return;
    setSendingTest(true);
    try {
      const resp = await fetch(`${relayUrl.replace(/\/$/, '')}/webhook/tentry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': webhookSecret || 'change-me' },
        body: JSON.stringify({ symbol: 'BTCUSDT', action: 'BUY', message: 'Test signal from Settings' }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || `Server responded ${resp.status}`);
      Alert.alert('Sent', 'Test signal sent — your phone should ring shortly.');
    } catch (e) {
      Alert.alert('Send failed', String(e.message || e));
    } finally {
      setSendingTest(false);
    }
  };

  const onClearHistory = async () => {
    await setJSON(KEYS.SIGNAL_HISTORY, []);
    setHistory([]);
  };

  const pickAlarmSong = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (result.canceled) return;
    const file = result.assets[0];
    setAlarmUri(file.uri);
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
      Alert.alert(
        'Still blocked',
        'Open Settings → Apps → Tentry Alarm → Notifications and enable it manually.',
        [{ text: 'Open Settings', onPress: () => Linking.openSettings() }, { text: 'Cancel' }]
      );
    }
  };

  const onRerunSetup = () => setPhase('onboarding');

  const onFixStep = async (key) => {
    // Mark that one step as incomplete so the onboarding screen's resume
    // logic lands on it directly instead of restarting from step 1.
    const current = (await getJSON(KEYS.SETUP_RESULTS, {})) || {};
    const next = { ...current, [key]: false };
    await setJSON(KEYS.SETUP_RESULTS, next);
    setResults(next);
    setPhase('onboarding');
  };

  const onOnboardingComplete = async () => {
    const savedResults = (await getJSON(KEYS.SETUP_RESULTS, null)) || {};
    setResults(savedResults);
    setPhase('main');
  };

  if (booting) {
    return <View style={{ flex: 1, backgroundColor: '#05070d' }} />;
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
              relayUrl={relayUrl}
              onFixNotifications={onFixNotifications}
              onFixStep={onFixStep}
              onGoSettings={() => setTab('settings')}
            />
          )}
          {tab === 'history' && <HistoryScreen history={history} onClearHistory={onClearHistory} />}
          {tab === 'settings' && (
            <SettingsScreen
              results={results}
              notifGranted={notifGranted}
              onFixNotifications={onFixNotifications}
              onFixStep={onFixStep}
              onRerunSetup={onRerunSetup}
              pushToken={pushToken}
              relayUrl={relayUrl}
              setRelayUrl={setRelayUrl}
              webhookSecret={webhookSecret}
              setWebhookSecret={setWebhookSecret}
              onSaveRelay={onSaveRelay}
              onRegisterToken={onRegisterToken}
              onSendTestSignal={onSendTestSignal}
              registering={registering}
              sendingTest={sendingTest}
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
;
  const [alarmName, setAlarmName] = useState(null);
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);
  const soundRef = useRef(null);

  const [history, setHistory] = useState([]);
  const [relayUrl, setRelayUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [registering, setRegistering] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [keepAwake, setKeepAwakeState] = useState(false);

  const appState = useRef(AppState.currentState);
  const pendingExternalStep = useRef(null);

  const steps = buildSteps({ onPushToken: setPushToken });

  // ---- Load persisted state on launch ----
  useEffect(() => {
    (async () => {
      const savedAlarm = await getJSON(KEYS.ALARM_URI, null);
      if (savedAlarm) {
        setAlarmUri(savedAlarm.uri);
        setAlarmName(savedAlarm.name);
      }
      const savedResults = await getJSON(KEYS.SETUP_RESULTS, null);
      if (savedResults) {
        setResults(savedResults);
        if (steps.every((s) => savedResults[s.key])) {
          setPhase('dashboard');
        }
      }
      const savedHistory = await getJSON(KEYS.SIGNAL_HISTORY, []);
      setHistory(savedHistory || []);
      setRelayUrl(await getString(KEYS.RELAY_URL, ''));
      setWebhookSecret(await getString(KEYS.WEBHOOK_SECRET, ''));
      const savedKeepAwake = await getJSON(KEYS.KEEP_AWAKE, false);
      setKeepAwakeState(!!savedKeepAwake);
      if (savedKeepAwake) KeepAwake.activateKeepAwakeAsync();

      const perm = await Notifications.getPermissionsAsync();
      setNotifGranted(perm.status === 'granted');
    })();
  }, []);

  // ---- Re-check notification permission whenever the app returns to
  // the foreground, and unlock "Continue" for external steps ----
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const cameBack = appState.current.match(/inactive|background/) && next === 'active';
      appState.current = next;
      if (cameBack) {
        const perm = await Notifications.getPermissionsAsync();
        setNotifGranted(perm.status === 'granted');
        if (pendingExternalStep.current) {
          setAwaitingReturn(true);
        }
      }
    });
    return () => sub.remove();
  }, []);

  const persistResults = async (next) => {
    setResults(next);
    await setJSON(KEYS.SETUP_RESULTS, next);
  };

  // ---- Drive automatic steps forward ----
  useEffect(() => {
    if (phase !== 'setup') return;
    const step = steps[stepIndex];
    if (!step) {
      setPhase('dashboard');
      return;
    }
    if (step.kind === 'auto') {
      const t = setTimeout(async () => {
        const ok = await step.run();
        await persistResults({ ...results, [step.key]: ok });
        setStepIndex((i) => i + 1);
      }, 250);
      return () => clearTimeout(t);
    }
    // external steps wait for explicit user interaction — see onOpenExternal/onAdvance
  }, [phase, stepIndex]);

  const onOpenExternal = async (step) => {
    pendingExternalStep.current = step.key;
    setAwaitingReturn(false);
    await step.openSettings();
  };

  const onAdvance = async (step, confirmed) => {
    await persistResults({ ...results, [step.key]: confirmed });
    pendingExternalStep.current = null;
    setAwaitingReturn(false);
    setStepIndex((i) => i + 1);
  };

  const onRerunSetup = () => {
    setStepIndex(0);
    setPhase('setup');
    setAwaitingReturn(false);
  };

  const onFixStep = (key) => {
    const idx = steps.findIndex((s) => s.key === key);
    if (idx === -1) return;
    setStepIndex(idx);
    setPhase('setup');
    setAwaitingReturn(false);
  };

  const onFixNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifGranted(status === 'granted');
    if (status !== 'granted') {
      Alert.alert(
        'Still blocked',
        'Open Settings → Apps → Tentry Alarm → Notifications and enable it manually.',
        [{ text: 'Open Settings', onPress: () => Linking.openSettings() }, { text: 'Cancel' }]
      );
    }
  };

  // ---- Alarm sound picking ----
  const pickAlarmSong = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (result.canceled) return;
    const file = result.assets[0];
    setAlarmUri(file.uri);
    setAlarmName(file.name);
    await setJSON(KEYS.ALARM_URI, { uri: file.uri, name: file.name });
  };

  const playAlarm = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeAndroid: 1,
        shouldDuckAndroid: false,
      });
      const source = alarmUri ? { uri: alarmUri } : require('./assets/alarm_sound.wav');
      const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true, isLooping: true, volume: 1.0 });
      soundRef.current = sound;
      setIsAlarmPlaying(true);
      await sound.playAsync();
    } catch (e) {
      console.warn('Alarm playback failed', e);
    }
  }, [alarmUri]);

  const stopAlarm = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setIsAlarmPlaying(false);
  };

  // ---- Incoming notifications ----
  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener(async (notification) => {
      const body = notification.request.content.body || 'Signal received';
      setLastSignal(body);
      const entry = { message: body, time: new Date().toLocaleTimeString() };
      const next = await pushSignalHistory(entry);
      setHistory(next);
      playAlarm();
    });
    const responseSub = Notifications.addNotificationResponseReceivedListener(() => {
      stopAlarm();
    });
    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [playAlarm]);

  // ---- Relay actions ----
  const onSaveRelay = async () => {
    await setString(KEYS.RELAY_URL, relayUrl.trim());
    await setString(KEYS.WEBHOOK_SECRET, webhookSecret);
    Alert.alert('Saved', 'Relay settings saved on this device.');
  };

  const onRegisterToken = async () => {
    if (!relayUrl || !pushToken) return;
    setRegistering(true);
    try {
      const resp = await fetch(`${relayUrl.replace(/\/$/, '')}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: pushToken }),
      });
      if (!resp.ok) throw new Error(`Server responded ${resp.status}`);
      Alert.alert('Registered', 'This device is now registered with your relay server.');
    } catch (e) {
      Alert.alert('Registration failed', String(e.message || e));
    } finally {
      setRegistering(false);
    }
  };

  const onSendTestSignal = async () => {
    if (!relayUrl) return;
    setSendingTest(true);
    try {
      const resp = await fetch(`${relayUrl.replace(/\/$/, '')}/webhook/tentry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': webhookSecret || 'change-me',
        },
        body: JSON.stringify({ symbol: 'BTCUSDT', action: 'BUY', message: 'Test signal from dashboard' }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || `Server responded ${resp.status}`);
      Alert.alert('Sent', 'Test signal sent — your phone should ring shortly.');
    } catch (e) {
      Alert.alert('Send failed', String(e.message || e));
    } finally {
      setSendingTest(false);
    }
  };

  const onToggleKeepAwake = async (value) => {
    setKeepAwakeState(value);
    await setJSON(KEYS.KEEP_AWAKE, value);
    if (value) {
      KeepAwake.activateKeepAwakeAsync();
    } else {
      KeepAwake.deactivateKeepAwake();
    }
  };

  const onClearHistory = async () => {
    await setJSON(KEYS.SIGNAL_HISTORY, []);
    setHistory([]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Tentry Alarm</Text>

        {phase === 'setup' ? (
          <SetupScreen
            steps={steps}
            stepIndex={stepIndex}
            onAdvance={onAdvance}
            onOpenExternal={onOpenExternal}
            awaitingReturn={awaitingReturn}
          />
        ) : (
          <DashboardScreen
            results={results}
            pushToken={pushToken}
            alarmName={alarmName}
            onPickSong={pickAlarmSong}
            onTestAlarm={playAlarm}
            onStopAlarm={stopAlarm}
            isAlarmPlaying={isAlarmPlaying}
            lastSignal={lastSignal}
            history={history}
            onClearHistory={onClearHistory}
            onRerunSetup={onRerunSetup}
            relayUrl={relayUrl}
            setRelayUrl={setRelayUrl}
            webhookSecret={webhookSecret}
            setWebhookSecret={setWebhookSecret}
            onSaveRelay={onSaveRelay}
            onRegisterToken={onRegisterToken}
            onSendTestSignal={onSendTestSignal}
            registering={registering}
            sendingTest={sendingTest}
            keepAwake={keepAwake}
            onToggleKeepAwake={onToggleKeepAwake}
            notifGranted={notifGranted}
            onFixNotifications={onFixNotifications}
            onFixStep={onFixStep}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '700', marginBottom: 20 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stepLabel: { color: COLORS.textFaint, fontSize: 13, marginBottom: 4 },
  stepTitle: { color: COLORS.text, fontSize: 18, fontWeight: '600', marginBottom: 8 },
  stepDesc: { color: COLORS.textDim, fontSize: 14, lineHeight: 20 },
  hint: { color: COLORS.textFaint, fontSize: 12, marginTop: 10, lineHeight: 16 },
  token: {
    color: COLORS.good,
    fontSize: 11,
    marginTop: 6,
    fontFamily: COLORS.mono,
    backgroundColor: '#0e1424',
    padding: 10,
    borderRadius: 8,
  },
  fieldLabel: { color: COLORS.textFaint, fontSize: 12, marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: '#0e1424',
    color: COLORS.text,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  button: {
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    backgroundColor: COLORS.cardAlt,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontWeight: '600' },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  statusLabel: { color: COLORS.textDim, fontSize: 14 },
  linkText: { color: COLORS.accent, fontSize: 13, fontWeight: '600' },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 8,
  },
  historyMsg: { color: COLORS.textDim, fontSize: 13, flex: 1, marginRight: 8 },
  historyTime: { color: COLORS.textFaint, fontSize: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
});

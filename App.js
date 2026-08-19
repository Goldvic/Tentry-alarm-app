import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
  AppState,
  TextInput,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import * as KeepAwake from 'expo-keep-awake';

import { KEYS, getJSON, setJSON, getString, setString, pushSignalHistory } from './lib/storage';

// ---------------------------------------------------------------------
// Notification behaviour while the app is in the foreground
// ---------------------------------------------------------------------
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

const ALARM_CHANNEL_ID = 'signal-alarm';
const ALARM_SOUND_ANDROID = 'alarm_sound.wav'; // must match app.json plugin "sounds" entry
const COLORS = {
  bg: '#0b0f19',
  card: '#161c2c',
  cardAlt: '#1d2438',
  border: '#232b45',
  text: '#ffffff',
  textDim: '#c3c9de',
  textFaint: '#8892b0',
  accent: '#ff3b30',
  accentDim: '#ff3b3033',
  good: '#3ddc84',
  warn: '#ffb020',
  mono: Platform.OS === 'android' ? 'monospace' : 'Courier',
};

// ---------------------------------------------------------------------
// Step definitions
//
// "auto" steps run themselves with no user gesture needed beyond the
// OS permission dialog. "external" steps navigate the user to a system
// Settings screen — those can ONLY be safely re-entered by a direct user
// tap (Android blocks apps from launching activities while backgrounded,
// which is what caused the old flow to silently die after DND).
// ---------------------------------------------------------------------
function buildSteps({ onPushToken }) {
  return [
    {
      key: 'notifications',
      kind: 'auto',
      title: 'Notification Permission',
      description: 'Required so the app can alert you the instant your bot sends a signal.',
      run: async () => {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowSound: true, allowBadge: true, allowCriticalAlerts: true },
        });
        return status === 'granted';
      },
    },
    {
      key: 'channel',
      kind: 'auto',
      title: 'Alarm Channel Setup',
      description: 'Creates a dedicated high-priority channel that can ring through silent mode.',
      run: async () => {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
            name: 'Trading Signal Alarm',
            importance: Notifications.AndroidImportance.MAX,
            sound: ALARM_SOUND_ANDROID,
            bypassDnd: true,
            enableVibrate: true,
            vibrationPattern: [0, 500, 500, 500, 500, 500],
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            audioAttributes: {
              usage: Notifications.AndroidAudioUsage.ALARM,
              contentType: Notifications.AndroidAudioContentType.SONIFICATION,
            },
          });
        }
        return true;
      },
    },
    {
      key: 'dnd',
      kind: 'external',
      title: 'Do Not Disturb Access',
      description:
        'Android requires a manual toggle to let this app bypass silent/DND mode. Tap below to open the exact settings screen, enable "Tentry Alarm", then come back and press Continue.',
      openSettings: async () => {
        try {
          await Linking.sendIntent('android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS');
        } catch (e) {
          await Linking.openSettings();
        }
      },
    },
    {
      key: 'battery',
      kind: 'external',
      title: 'Battery Optimization',
      description:
        'Disabling battery optimization stops Android from killing the app in the background, so alarms still ring after your phone has been idle. Tap below, choose "Allow" / "Don\'t optimize", then come back and press Continue.',
      openSettings: async () => {
        try {
          await Linking.sendIntent('android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', [
            { key: 'package', value: Constants.expoConfig?.android?.package },
          ]);
        } catch (e) {
          await Linking.openSettings();
        }
      },
    },
    {
      key: 'pushtoken',
      kind: 'auto',
      title: 'Registering This Device',
      description: "Generates the push token your relay server uses to target this exact phone.",
      run: async () => {
        if (!Device.isDevice) return false;
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const tokenResponse = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        onPushToken && onPushToken(tokenResponse.data);
        return true;
      },
    },
  ];
}

// ---------------------------------------------------------------------
// Small shared UI pieces
// ---------------------------------------------------------------------
function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function SectionTitle({ children }) {
  return <Text style={styles.stepTitle}>{children}</Text>;
}

function Pill({ ok, label }) {
  return (
    <View style={[pillStyles.base, ok ? pillStyles.good : pillStyles.warn]}>
      <Text style={pillStyles.text}>{label}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  base: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' },
  good: { backgroundColor: '#123b2b' },
  warn: { backgroundColor: '#3b2e12' },
  text: { color: '#fff', fontSize: 12, fontWeight: '600' },
});

function PrimaryButton({ label, onPress, disabled, loading }) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function SecondaryButton({ label, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.buttonSecondary, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------
// Setup flow screen
// ---------------------------------------------------------------------
function SetupScreen({ steps, stepIndex, onAdvance, onOpenExternal, awaitingReturn }) {
  const step = steps[stepIndex];
  if (!step) return null;

  return (
    <Card>
      <Text style={styles.stepLabel}>
        Step {stepIndex + 1} of {steps.length}
      </Text>
      <SectionTitle>{step.title}</SectionTitle>
      <Text style={styles.stepDesc}>{step.description}</Text>

      {step.kind === 'external' && (
        <View style={{ marginTop: 14 }}>
          <PrimaryButton
            label={awaitingReturn ? 'Open Settings Again' : 'Open Settings'}
            onPress={() => onOpenExternal(step)}
          />
          <View style={{ height: 10 }} />
          <SecondaryButton
            label="I've done this — Continue"
            onPress={() => onAdvance(step, true)}
            disabled={!awaitingReturn}
          />
          {!awaitingReturn && (
            <Text style={styles.hint}>Continue unlocks once you've opened Settings and come back.</Text>
          )}
        </View>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------
// Dashboard screen
// ---------------------------------------------------------------------
function DashboardScreen({
  results,
  pushToken,
  alarmName,
  onPickSong,
  onTestAlarm,
  onStopAlarm,
  isAlarmPlaying,
  lastSignal,
  history,
  onClearHistory,
  onRerunSetup,
  relayUrl,
  setRelayUrl,
  webhookSecret,
  setWebhookSecret,
  onSaveRelay,
  onRegisterToken,
  onSendTestSignal,
  registering,
  sendingTest,
  keepAwake,
  onToggleKeepAwake,
  notifGranted,
  onFixNotifications,
  onFixStep,
}) {
  const [copied, setCopied] = useState(false);

  const copyToken = async () => {
    if (!pushToken) return;
    await Clipboard.setStringAsync(pushToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const allGood = notifGranted && results.dnd && results.battery && pushToken;

  return (
    <>
      {/* Status */}
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <SectionTitle>Status</SectionTitle>
          <Pill ok={allGood} label={allGood ? 'All set' : 'Needs attention'} />
        </View>

        <StatusRow label="Notifications" ok={notifGranted} onFix={onFixNotifications} />
        <StatusRow label="Do Not Disturb bypass" ok={!!results.dnd} onFix={() => onFixStep('dnd')} />
        <StatusRow label="Battery optimization exempt" ok={!!results.battery} onFix={() => onFixStep('battery')} />
        <StatusRow label="Device registered" ok={!!pushToken} onFix={onRerunSetup} />

        <Text style={styles.hint}>
          Android can't report DND/battery status back to the app — these reflect what you confirmed
          during setup. Use "Fix" if signals ever stop arriving.
        </Text>
      </Card>

      {/* Alarm sound */}
      <Card>
        <SectionTitle>Alarm Sound</SectionTitle>
        <Text style={styles.stepDesc}>
          {alarmName ? `Currently using: ${alarmName}` : 'Using the built-in siren tone.'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
          <View style={{ marginRight: 10, marginBottom: 10 }}>
            <SecondaryButton label={alarmName ? 'Change Song' : 'Choose Song'} onPress={onPickSong} />
          </View>
          {!isAlarmPlaying ? (
            <SecondaryButton label="Test Alarm" onPress={onTestAlarm} />
          ) : (
            <PrimaryButton label="Stop Alarm" onPress={onStopAlarm} />
          )}
        </View>
      </Card>

      {/* Relay connection */}
      <Card>
        <SectionTitle>Relay Connection</SectionTitle>
        <Text style={styles.stepDesc}>Your push token (used by the relay server to target this phone):</Text>
        <Text selectable style={styles.token}>{pushToken || 'Not generated yet'}</Text>
        <View style={{ marginTop: 8, marginBottom: 16, alignItems: 'flex-start' }}>
          <SecondaryButton label={copied ? 'Copied ✓' : 'Copy Token'} onPress={copyToken} disabled={!pushToken} />
        </View>

        <Text style={styles.fieldLabel}>Relay Server URL</Text>
        <TextInput
          style={styles.input}
          placeholder="https://your-relay.onrender.com"
          placeholderTextColor={COLORS.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          value={relayUrl}
          onChangeText={setRelayUrl}
        />

        <Text style={styles.fieldLabel}>Webhook Secret</Text>
        <TextInput
          style={styles.input}
          placeholder="change-me"
          placeholderTextColor={COLORS.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          value={webhookSecret}
          onChangeText={setWebhookSecret}
        />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 }}>
          <View style={{ marginRight: 10, marginBottom: 10 }}>
            <SecondaryButton label="Save" onPress={onSaveRelay} />
          </View>
          <View style={{ marginRight: 10, marginBottom: 10 }}>
            <SecondaryButton
              label={registering ? 'Registering…' : 'Register Device'}
              onPress={onRegisterToken}
              disabled={registering || !relayUrl || !pushToken}
            />
          </View>
          <PrimaryButton
            label={sendingTest ? 'Sending…' : 'Send Test Signal'}
            onPress={onSendTestSignal}
            loading={sendingTest}
            disabled={!relayUrl}
          />
        </View>
        <Text style={styles.hint}>
          "Register Device" saves your token on the relay automatically. "Send Test Signal" fires a fake
          BUY signal through the relay to your phone, end to end.
        </Text>
      </Card>

      {/* Last signal */}
      {lastSignal && (
        <Card>
          <SectionTitle>Last Signal</SectionTitle>
          <Text style={styles.stepDesc}>{lastSignal}</Text>
          {isAlarmPlaying && (
            <View style={{ marginTop: 10, alignItems: 'flex-start' }}>
              <PrimaryButton label="Stop Alarm" onPress={onStopAlarm} />
            </View>
          )}
        </Card>
      )}

      {/* History */}
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <SectionTitle>Recent Signals</SectionTitle>
          {history.length > 0 && (
            <TouchableOpacity onPress={onClearHistory}>
              <Text style={styles.linkText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
        {history.length === 0 ? (
          <Text style={styles.stepDesc}>No signals yet — send a test above to see one here.</Text>
        ) : (
          history.map((h, i) => (
            <View key={i} style={styles.historyRow}>
              <Text style={styles.historyMsg}>{h.message}</Text>
              <Text style={styles.historyTime}>{h.time}</Text>
            </View>
          ))
        )}
      </Card>

      {/* Settings */}
      <Card>
        <SectionTitle>Settings</SectionTitle>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepDesc}>Keep screen awake while app is open</Text>
          </View>
          <Switch value={keepAwake} onValueChange={onToggleKeepAwake} trackColor={{ true: COLORS.accent }} />
        </View>
        <SecondaryButton label="Re-run Full Setup" onPress={onRerunSetup} />
      </Card>
    </>
  );
}

function StatusRow({ label, ok, onFix }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>
        {ok ? '✅' : '⚠️'} {label}
      </Text>
      {!ok && onFix && (
        <TouchableOpacity onPress={onFix}>
          <Text style={styles.linkText}>Fix</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------
export default function App() {
  const [phase, setPhase] = useState('setup'); // 'setup' | 'dashboard'
  const [stepIndex, setStepIndex] = useState(0);
  const [results, setResults] = useState({});
  const [pushToken, setPushToken] = useState(null);
  const [awaitingReturn, setAwaitingReturn] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);

  const [lastSignal, setLastSignal] = useState(null);
  const [alarmUri, setAlarmUri] = useState(null);
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

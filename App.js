import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
  AppState,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Key used to remember which song the user picked, across app restarts.
const ALARM_URI_KEY = 'alarm_music_uri';

// ---- How incoming notifications behave while app is open ----
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

const ALARM_CHANNEL_ID = 'signal-alarm';

// Ordered list of setup steps. Each has a label, a description shown to the
// user, and a run() function. They fire one at a time so the user sees a
// clear native permission dialog for each, instead of a wall of prompts.
function buildSteps({ onPushToken, onChannelReady }) {
  return [
    {
      key: 'notifications',
      title: 'Notification Permission',
      description:
        'Required so the app can alert you the instant your bot sends a signal.',
      run: async () => {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowSound: true,
            allowBadge: true,
            allowCriticalAlerts: true,
          },
        });
        return status === 'granted';
      },
    },
    {
      key: 'channel',
      title: 'Alarm Channel Setup',
      description:
        'Creates a dedicated high-priority alarm channel that can ring through silent mode.',
      run: async () => {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
            name: 'Trading Signal Alarm',
            importance: Notifications.AndroidImportance.MAX,
            sound: 'alarm_sound.wav',
            bypassDnd: true,
            enableVibrate: true,
            vibrationPattern: [0, 500, 500, 500, 500, 500],
            lockscreenVisibility:
              Notifications.AndroidNotificationVisibility.PUBLIC,
            audioAttributes: {
              usage: Notifications.AndroidAudioUsage.ALARM,
              contentType: Notifications.AndroidAudioContentType.SONIFICATION,
            },
          });
        }
        onChannelReady && onChannelReady();
        return true;
      },
    },
    {
      key: 'dnd',
      title: 'Do Not Disturb Access',
      description:
        'Android requires you to manually flip one switch so this app is allowed to bypass silent/DND mode. Tapping this opens the exact settings screen — just enable "Tentry Alarm".',
      run: async () => {
        if (Platform.OS === 'android') {
          try {
            await Linking.sendIntent(
              'android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS'
            );
          } catch (e) {
            await Linking.openSettings();
          }
        }
        return true; // user grants manually in system UI; we can't verify synchronously
      },
    },
    {
      key: 'battery',
      title: 'Battery Optimization',
      description:
        'Disabling battery optimization for this app stops Android from killing it in the background, so signals still ring when your phone has been idle.',
      run: async () => {
        if (Platform.OS === 'android') {
          try {
            await Linking.sendIntent(
              'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
              [{ key: 'package', value: Constants.expoConfig?.android?.package }]
            );
          } catch (e) {
            await Linking.openSettings();
          }
        }
        return true;
      },
    },
    {
      key: 'pushtoken',
      title: 'Registering This Device',
      description:
        'Generates the push token your relay server uses to target this exact phone.',
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

export default function App() {
  const [stepIndex, setStepIndex] = useState(0);
  const [results, setResults] = useState({});
  const [pushToken, setPushToken] = useState(null);
  const [setupDone, setSetupDone] = useState(false);
  const [lastSignal, setLastSignal] = useState(null);
  const [alarmUri, setAlarmUri] = useState(null);
  const [alarmName, setAlarmName] = useState(null);
  const soundRef = useRef(null);

  // Load previously-picked song on launch
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(ALARM_URI_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setAlarmUri(parsed.uri);
          setAlarmName(parsed.name);
        } catch (e) {}
      }
    })();
  }, []);

  const pickAlarmSong = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets[0];
    setAlarmUri(file.uri);
    setAlarmName(file.name);
    await AsyncStorage.setItem(
      ALARM_URI_KEY,
      JSON.stringify({ uri: file.uri, name: file.name })
    );
  };

  const steps = buildSteps({
    onPushToken: setPushToken,
    onChannelReady: () => {},
  });

  const runStep = async (index) => {
    const step = steps[index];
    if (!step) {
      setSetupDone(true);
      return;
    }
    const ok = await step.run();
    setResults((prev) => ({ ...prev, [step.key]: ok }));
    setStepIndex(index + 1);
  };

  useEffect(() => {
    if (!setupDone && stepIndex < steps.length) {
      // slight delay so each native dialog doesn't feel instant/jarring
      const t = setTimeout(() => runStep(stepIndex), 300);
      return () => clearTimeout(t);
    } else if (stepIndex >= steps.length) {
      setSetupDone(true);
    }
  }, [stepIndex, setupDone]);

  // Play the alarm sound at max volume when a signal notification arrives,
  // whether the app is foregrounded or backgrounded.
  const playAlarm = async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeAndroid: 1, // DUCK_OTHERS
        shouldDuckAndroid: false,
      });
      // Prefer the song the user picked from their phone; fall back to the
      // bundled placeholder tone only if nothing was picked yet.
      const source = alarmUri
        ? { uri: alarmUri }
        : require('./assets/alarm_sound.wav');
      const { sound } = await Audio.Sound.createAsync(source, {
        shouldPlay: true,
        isLooping: true,
        volume: 1.0,
      });
      soundRef.current = sound;
      await sound.playAsync();
    } catch (e) {
      console.warn('Alarm playback failed', e);
    }
  };

  const stopAlarm = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
  };

  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        setLastSignal(notification.request.content.body || 'Signal received');
        playAlarm();
      }
    );
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      () => {
        stopAlarm();
      }
    );
    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  const currentStep = steps[stepIndex];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Tentry Alarm</Text>

        {!setupDone && currentStep && (
          <View style={styles.card}>
            <Text style={styles.stepLabel}>
              Step {stepIndex + 1} of {steps.length}
            </Text>
            <Text style={styles.stepTitle}>{currentStep.title}</Text>
            <Text style={styles.stepDesc}>{currentStep.description}</Text>
          </View>
        )}

        {setupDone && (
          <View style={styles.card}>
            <Text style={styles.stepTitle}>Alarm Sound</Text>
            <Text style={styles.stepDesc}>
              {alarmName
                ? `Currently using: ${alarmName}`
                : 'Using default placeholder tone. Pick a song from your phone instead:'}
            </Text>
            <TouchableOpacity style={styles.button} onPress={pickAlarmSong}>
              <Text style={styles.buttonText}>
                {alarmName ? 'Change Song' : 'Choose Song from Music Folder'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {setupDone && (
          <View style={styles.card}>
            <Text style={styles.stepTitle}>Setup Complete ✅</Text>
            {Object.entries(results).map(([k, v]) => (
              <Text key={k} style={styles.resultLine}>
                {v ? '✅' : '⚠️'} {k}
              </Text>
            ))}
            <Text style={styles.hint}>
              Double-check "Tentry Alarm" is toggled ON in Settings → Sound →
              Do Not Disturb → Apps (this can't be auto-verified — Android
              requires the manual toggle).
            </Text>
          </View>
        )}

        {pushToken && (
          <View style={styles.card}>
            <Text style={styles.stepTitle}>Your Push Token</Text>
            <Text selectable style={styles.token}>
              {pushToken}
            </Text>
            <Text style={styles.hint}>
              Paste this into your relay server's DEVICE_TOKEN value (see
              relay-server/README).
            </Text>
          </View>
        )}

        {lastSignal && (
          <View style={styles.card}>
            <Text style={styles.stepTitle}>Last Signal</Text>
            <Text style={styles.stepDesc}>{lastSignal}</Text>
            <TouchableOpacity style={styles.button} onPress={stopAlarm}>
              <Text style={styles.buttonText}>Stop Alarm</Text>
            </TouchableOpacity>
          </View>
        )}

        {setupDone && (
          <TouchableOpacity
            style={styles.buttonSecondary}
            onPress={() => {
              setStepIndex(0);
              setResults({});
              setSetupDone(false);
            }}
          >
            <Text style={styles.buttonText}>Re-run Setup</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0f19' },
  scroll: { padding: 20, paddingTop: 60 },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#161c2c',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  stepLabel: { color: '#8892b0', fontSize: 13, marginBottom: 4 },
  stepTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  stepDesc: { color: '#c3c9de', fontSize: 14, lineHeight: 20 },
  resultLine: { color: '#c3c9de', fontSize: 14, marginTop: 4 },
  hint: { color: '#8892b0', fontSize: 12, marginTop: 10, lineHeight: 16 },
  token: {
    color: '#7ee787',
    fontSize: 12,
    marginTop: 6,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  button: {
    backgroundColor: '#ff3b30',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#2a3350',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});

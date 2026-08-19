import { Platform, Vibration } from 'react-native';
import { Audio } from 'expo-av';
import notifee, { TriggerType } from '@notifee/react-native';
import { VIBRATION_PATTERNS } from './theme';
import { ALARM_CHANNEL_ID, displayAlarmNotification, stopAlarmNotification } from './notifications';

let VolumeManager = null;
try {
  // Optional native module — wrapped so a missing/failed native build
  // (e.g. before the first `eas build` after adding it) degrades to
  // "plays at whatever the alarm stream is currently at" instead of
  // crashing the whole app.
  VolumeManager = require('react-native-volume-manager').VolumeManager;
} catch (e) {
  VolumeManager = null;
}

let soundRef = null;
let vibrating = false;

// Android has separate volume streams (media, ringer, alarm, ...). Silent
// mode mutes the ringer/notification streams but the ALARM stream is a
// distinct one — this is what expo-notifications' audioAttributes.usage:
// ALARM channel config already routes playback through. Forcing that
// stream to max (independent of whatever the user last left it at) is
// the "override the volume even on silent" behavior — silent mode does
// not touch the alarm stream at all, so this only ever raises it, never
// unmutes the ringer.
export async function forceAlarmStreamVolume(targetVolume = 1) {
  if (Platform.OS !== 'android' || !VolumeManager) return;
  try {
    await VolumeManager.setVolume(targetVolume, { type: 'alarm', playSound: false, showUI: false });
  } catch (e) {
    // best-effort — some OEM ROMs restrict programmatic volume changes
  }
}

export async function startRinging({ soundUri, forceMaxVolume, alarmVolume, vibrationPattern }) {
  await stopRinging();

  if (forceMaxVolume) {
    await forceAlarmStreamVolume(1);
  }

  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeAndroid: 1, // DUCK_OTHERS off — INTERRUPTION_MODE_ANDROID_DO_NOT_MIX
      shouldDuckAndroid: false,
    });
    const source = soundUri ? { uri: soundUri } : require('../assets/alarm_sound.wav');
    const { sound } = await Audio.Sound.createAsync(source, {
      shouldPlay: true,
      isLooping: true,
      volume: forceMaxVolume ? 1 : alarmVolume,
    });
    soundRef = sound;
    await sound.playAsync();
  } catch (e) {
    console.warn('Alarm playback failed', e);
  }

  const patternKey = vibrationPattern || 'pulse';
  const pattern = (VIBRATION_PATTERNS[patternKey] || VIBRATION_PATTERNS.pulse).pattern;
  if (patternKey !== 'off') {
    vibrating = true;
    Vibration.vibrate(pattern, true);
  }

  return true;
}

export async function stopRinging() {
  if (soundRef) {
    try {
      await soundRef.stopAsync();
      await soundRef.unloadAsync();
    } catch (e) {}
    soundRef = null;
  }
  if (vibrating) {
    Vibration.cancel();
    vibrating = false;
  }
  await stopAlarmNotification();
}

export function isRingingNow() {
  return !!soundRef;
}

// Snooze = stop ringing now, schedule a notifee trigger notification N
// minutes out that re-displays the same full-screen alarm card. Uses
// notifee's timestamp trigger so it fires even if the app gets killed
// in between (relies on the OS alarm/trigger manager, not a JS timer).
export async function snoozeRinging({ minutes, title, body, data }) {
  await stopRinging();
  const fireDate = Date.now() + Math.max(1, minutes) * 60 * 1000;
  try {
    await notifee.createTriggerNotification(
      {
        title: `⏰ Snoozed — ${title || 'Signal'}`,
        body: body || 'Snoozed alarm',
        data: { ...data, kind: 'alarm', snoozed: 'true' },
        android: {
          channelId: ALARM_CHANNEL_ID,
          category: 'alarm',
          fullScreenAction: { id: 'default', launchActivity: 'default' },
          pressAction: { id: 'default', launchActivity: 'default' },
          actions: [
            { title: 'Snooze', pressAction: { id: 'snooze' } },
            { title: 'Dismiss', pressAction: { id: 'dismiss' } },
          ],
        },
      },
      { type: TriggerType.TIMESTAMP, timestamp: fireDate }
    );
  } catch (e) {
    console.warn('Failed to schedule snooze', e);
  }
}

export async function ringImmediately({ title, body, data }) {
  await displayAlarmNotification({ title, body, data });
}

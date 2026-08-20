import { Platform, Vibration } from 'react-native';
import { Audio } from 'expo-av';
import notifee, {
  TriggerType,
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';
import { VIBRATION_PATTERNS } from './theme';
import { ALARM_CHANNEL_ID, ALARM_SILENT_CHANNEL_ID, presentAlarmNotification, stopAlarmNotification } from './notifications';

let VolumeManager = null;
try {
  VolumeManager = require('react-native-volume-manager').VolumeManager;
} catch (e) {
  VolumeManager = null;
}

let soundRef = null;
let vibrating = false;
let currentRingMeta = null;

/** Force both ALARM and MUSIC (media) streams to max so the phone is loud. */
export async function forceAlarmStreamVolume(targetVolume = 1) {
  if (Platform.OS !== 'android' || !VolumeManager) return;
  try {
    await VolumeManager.setVolume(targetVolume, { type: 'alarm', playSound: false, showUI: false });
  } catch (e) {}
  try {
    await VolumeManager.setVolume(targetVolume, { type: 'music', playSound: false, showUI: false });
  } catch (e) {}
  try {
    await VolumeManager.setVolume(targetVolume, { type: 'system', playSound: false, showUI: false });
  } catch (e) {}
}

export async function startRinging({
  soundUri,
  forceMaxVolume = true,
  alarmVolume = 1,
  vibrationPattern = 'pulse',
  meta = null,
}) {
  await stopRinging(false);

  if (forceMaxVolume) {
    await forceAlarmStreamVolume(1);
  }

  if (meta) currentRingMeta = meta;

  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeAndroid: 1,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });

    let source;
    if (soundUri) {
      source = { uri: soundUri };
    } else {
      source = require('../assets/alarm_sound.wav');
    }

    const vol = forceMaxVolume ? 1 : Math.max(0.1, Math.min(1, alarmVolume));

    // Retry once if custom URI fails (common with content:// after kill)
    let sound;
    try {
      const created = await Audio.Sound.createAsync(source, {
        shouldPlay: true,
        isLooping: true,
        volume: vol,
      });
      sound = created.sound;
    } catch (uriErr) {
      if (soundUri) {
        console.warn('Custom sound failed, falling back to built-in', uriErr);
        const created = await Audio.Sound.createAsync(require('../assets/alarm_sound.wav'), {
          shouldPlay: true,
          isLooping: true,
          volume: vol,
        });
        sound = created.sound;
      } else {
        throw uriErr;
      }
    }

    soundRef = sound;
    await sound.playAsync();

    // Re-assert volume after playback starts (some OEMs reset streams)
    if (forceMaxVolume) {
      setTimeout(() => forceAlarmStreamVolume(1), 300);
      setTimeout(() => forceAlarmStreamVolume(1), 1200);
    }
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

/**
 * Hard stop: unload expo-av, cancel vibration, cancel every alarm tray item
 * (notifee + expo), and cancel any pending snooze triggers that use the loud
 * channel. Monitoring FGS is left running (silent).
 */
export async function stopRinging(cancelNotification = true) {
  // 1) Stop in-app audio first — this is the only legitimate sound source
  if (soundRef) {
    try {
      await soundRef.stopAsync();
    } catch (e) {}
    try {
      await soundRef.unloadAsync();
    } catch (e) {}
    soundRef = null;
  }
  // Belt-and-suspenders: reset audio mode so nothing keeps a media session
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeAndroid: 1,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (e) {}

  if (vibrating) {
    try {
      Vibration.cancel();
    } catch (e) {}
    vibrating = false;
  }

  if (cancelNotification) {
    await stopAlarmNotification({ restartMonitoring: true });
    // Cancel any scheduled snooze triggers (they use the LOUD channel)
    try {
      const triggers = await notifee.getTriggerNotifications();
      await Promise.all(
        (triggers || []).map((t) => {
          const id = t?.notification?.id;
          if (id) return notifee.cancelTriggerNotification(id).catch(() => {});
          return Promise.resolve();
        })
      );
    } catch (e) {}
    // Nuke any remaining displayed notifs that look like alarms (not monitoring)
    try {
      const displayed = await notifee.getDisplayedNotifications();
      await Promise.all(
        (displayed || [])
          .filter((n) => {
            const d = n.notification?.data || {};
            const id = n.id || n.notification?.id;
            if (id === 'tentry-monitoring' || d.kind === 'monitoring') return false;
            return (
              d.kind === 'alarm' ||
              d.tentry_alarm === '1' ||
              id === 'tentry-active-alarm' ||
              String(id || '').startsWith('snooze-')
            );
          })
          .map((n) =>
            notifee
              .cancelNotification(n.id, n.notification?.android?.tag)
              .catch(() => notifee.cancelNotification(n.id).catch(() => {}))
          )
      );
    } catch (e) {}
  }

  currentRingMeta = null;
}

export function isRingingNow() {
  return !!soundRef;
}

export function getCurrentRingMeta() {
  return currentRingMeta;
}

export async function snoozeRinging({ minutes, title, body, data }) {
  await stopRinging(true);
  const fireDate = Date.now() + Math.max(1, minutes || 5) * 60 * 1000;
  const payload = { ...(data || {}), kind: 'alarm', snoozed: 'true' };
  try {
    // Snooze uses SILENT channel + no system loopSound. Sound is started by
    // our JS path when the trigger fires (same as a normal signal).
    await notifee.createTriggerNotification(
      {
        id: `snooze-${fireDate}`,
        title: `Snoozed — ${title || 'Signal'}`,
        body: body || 'Alarm will ring again',
        data: payload,
        android: {
          channelId: ALARM_SILENT_CHANNEL_ID,
          category: AndroidCategory.ALARM,
          importance: AndroidImportance.HIGH,
          loopSound: false,
          sound: undefined,
          ongoing: true,
          autoCancel: false,
          visibility: AndroidVisibility.PUBLIC,
          fullScreenAction: { id: 'default', launchActivity: 'default' },
          pressAction: { id: 'default', launchActivity: 'default' },
          // Do NOT attach asForegroundService — monitoring FGS already owns keep-alive
          actions: [
            { title: 'Snooze', pressAction: { id: 'snooze' } },
            { title: 'Dismiss', pressAction: { id: 'dismiss' } },
          ],
        },
        ios: {
          critical: false,
          sound: undefined,
          interruptionLevel: 'timeSensitive',
        },
      },
      { type: TriggerType.TIMESTAMP, timestamp: fireDate, alarmManager: { allowWhileIdle: true } }
    );
  } catch (e) {
    console.warn('Failed to schedule snooze', e);
  }
}

export async function ringImmediately({ title, body, data }) {
  await presentAlarmNotification({ title, body, data });
}

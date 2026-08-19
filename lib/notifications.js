import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import notifee, { AndroidCategory, AndroidImportance, AndroidVisibility, EventType } from '@notifee/react-native';

// Must match the filename expo-notifications' config plugin copies
// assets/alarm_sound.wav into android/app/src/main/res/raw/ as (no
// extension). Both expo-notifications' own channel below AND notifee's
// channel reference this same physical file — see README "Custom alarm
// sound" section if you ever rename the asset.
export const ALARM_SOUND_RAW = 'alarm_sound';
export const ALARM_SOUND_FILE = 'alarm_sound.wav';
export const ALARM_CHANNEL_ID = 'signal-alarm-v4';

// expo-notifications' own handler — controls what happens while the JS
// thread is alive and the app is foregrounded. The actual full-screen
// ringing UI is driven by notifee (below), not this.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

export async function requestNotificationPermissions() {
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: true, allowCriticalAlerts: true },
  });
  // notifee's own permission request additionally covers Android 13+
  // POST_NOTIFICATIONS on some OEMs and iOS provisional settings — safe
  // to call even where it's a no-op.
  try {
    await notifee.requestPermission();
  } catch (e) {
    // non-fatal — expo-notifications' grant above is what we gate setup on
  }
  return status === 'granted';
}

export async function getNotificationPermissionStatus() {
  const perm = await Notifications.getPermissionsAsync();
  return perm.status === 'granted';
}

// Android 14 (API 34+) added a dedicated toggle for "use full screen
// intent" separate from the notification permission — an app can have
// notifications allowed but full-screen-intent silently downgraded to a
// heads-up banner. notifee exposes this in getNotificationSettings().
export async function getFullScreenIntentGranted() {
  if (Platform.OS !== 'android') return true;
  try {
    const settings = await notifee.getNotificationSettings();
    // fullScreenIntent may be undefined on API <34, where it's implicitly
    // granted by the manifest permission alone.
    if (settings.android && typeof settings.android.fullScreenIntent === 'number') {
      // notifee.AndroidNotificationSetting.ENABLED === 1
      return settings.android.fullScreenIntent === 1;
    }
    return true;
  } catch (e) {
    return true;
  }
}

export async function openFullScreenIntentSettings() {
  try {
    await notifee.openAlarmPermissionSettings();
  } catch (e) {
    // older notifee / OS without this screen — Settings app fallback
  }
}

export async function createAlarmChannel() {
  if (Platform.OS !== 'android') return;

  // The expo-notifications channel — kept for parity with any code path
  // still using the Notifications API directly (e.g. remote push display
  // when the app is fully killed on some OEMs).
  await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
    name: 'Trading Signal Alarm',
    importance: Notifications.AndroidImportance.MAX,
    sound: ALARM_SOUND_FILE,
    bypassDnd: true,
    enableVibrate: true,
    // Three buzz/pause cycles. notifee (below) requires every value to be
    // positive — a leading 0 (meant as "start immediately") is rejected
    // with "expected an array containing an even number of positive
    // values", so there's no 0 here even though this expo-notifications
    // channel would have tolerated one.
    vibrationPattern: [500, 500, 500, 500, 500, 500],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.ALARM,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
    },
  });

  // notifee's channel — this is the one that actually drives the
  // full-screen ringing card, since notifee (unlike expo-notifications)
  // exposes fullScreenAction directly.
  await notifee.createChannel({
    id: ALARM_CHANNEL_ID,
    name: 'Trading Signal Alarm',
    importance: AndroidImportance.HIGH,
    sound: ALARM_SOUND_RAW,
    bypassDnd: true,
    vibration: true,
    vibrationPattern: [500, 500, 500, 500, 500, 500],
    visibility: AndroidVisibility.PUBLIC,
  });
}

// Fires the actual alarm-style notification: full-screen intent (wakes
// the screen and launches the app over the lock screen, like a real
// alarm clock) plus Snooze/Dismiss action buttons for when the user
// responds from the lock screen without opening the app fully.
export async function displayAlarmNotification({ title, body, data }) {
  await notifee.displayNotification({
    title,
    body,
    data: { ...data, kind: 'alarm' },
    android: {
      channelId: ALARM_CHANNEL_ID,
      category: AndroidCategory.ALARM,
      importance: AndroidImportance.HIGH,
      loopSound: true,
      ongoing: true,
      autoCancel: false,
      visibility: AndroidVisibility.PUBLIC,
      fullScreenAction: { id: 'default', launchActivity: 'default' },
      pressAction: { id: 'default', launchActivity: 'default' },
      actions: [
        { title: 'Snooze', pressAction: { id: 'snooze' } },
        { title: 'Dismiss', pressAction: { id: 'dismiss' } },
      ],
    },
    ios: {
      critical: true,
      sound: 'default',
      interruptionLevel: 'timeSensitive',
    },
  });
}

export async function stopAlarmNotification() {
  try {
    await notifee.stopForegroundService();
  } catch (e) {}
  try {
    const displayed = await notifee.getDisplayedNotifications();
    await Promise.all(
      displayed.filter((n) => n.notification?.data?.kind === 'alarm').map((n) => notifee.cancelNotification(n.id))
    );
  } catch (e) {}
}

export { EventType };

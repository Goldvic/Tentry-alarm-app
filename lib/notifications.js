import { Platform, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
  AndroidForegroundServiceType,
  EventType,
} from '@notifee/react-native';

export const ALARM_SOUND_RAW = 'alarm_sound';
export const ALARM_SOUND_FILE = 'alarm_sound.wav';
export const ALARM_CHANNEL_ID = 'signal-alarm-v5';
// Silent visual channel for the signal tray notification. Sound is owned by
// the in-app expo-av engine only — the system notification must never beep.
// Bumped to force Android to drop any previously-created channel that may have
// had sound/vibration attached (OEM bugs + channel immutability).
export const ALARM_SILENT_CHANNEL_ID = 'signal-alarm-silent-v2';
// Bumped whenever channel behaviour changes — Android never updates sound /
// vibration / visibility on an existing channel after first creation.
export const MONITORING_CHANNEL_ID = 'tentry-monitoring-v4';
export const MONITORING_NOTIFICATION_ID = 'tentry-monitoring';
const LEGACY_MONITORING_CHANNEL_IDS = [
  'tentry-monitoring-v1',
  'tentry-monitoring-v2',
  'tentry-monitoring-v3',
];
const LEGACY_ALARM_SILENT_CHANNEL_IDS = [
  'signal-alarm-silent-v1',
];

// Builds display title/body from the raw signal fields when the push arrived as a
// headless/data-only message (no top-level title or body — see buildSignalPush note
// in the README / chat). Falls back to whatever title/body WAS provided otherwise.
export function buildSignalText({ title, body, data = {} } = {}) {
  const symbol = data.symbol || 'Signal';
  const action = data.action ? String(data.action).toUpperCase() : '';
  const resolvedTitle = title || [symbol, action].filter(Boolean).join(' ') || 'Trading Signal';

  let resolvedBody = body;
  if (!resolvedBody) {
    const parts = [];
    if (data.entry) parts.push(`entry ${data.entry}`);
    if (data.sl) parts.push(`SL ${data.sl}`);
    if (data.tp) parts.push(`TP ${data.tp}`);
    resolvedBody = parts.length ? parts.join(', ') : 'Signal received';
  }
  return { title: resolvedTitle, body: resolvedBody };
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification?.request?.content?.data || {};
    const kind = data?.kind;
    // Monitoring + signal tray alerts must never play system sound.
    // Alarm audio is driven only by the in-app expo-av engine (startRinging).
    const silent = kind === 'monitoring' || kind === 'alarm' || data?.tentry_alarm === '1';
    return {
      shouldShowAlert: true,
      shouldPlaySound: !silent,
      shouldSetBadge: false,
      priority: Notifications.AndroidNotificationPriority.MAX,
    };
  },
});

// Keep a long-lived JS task while ANY foreground service notification is active
// (permanent monitoring service OR the active alarm). This is what makes the
// process hard for Android to kill after the user swipes the app from Recents.
// While this promise is pending we also run the signal bridge (ntfy / HTTP poll)
// so signals arrive even when Expo Push is blocked by the OEM.
try {
  notifee.registerForegroundService(() => {
    try {
      const { startSignalBridge } = require('./signalBridge');
      startSignalBridge();
    } catch (e) {
      console.warn('[Tentry] bridge start from FGS failed', e);
    }
    return new Promise(() => {
      // Resolved only when stopForegroundService is called
    });
  });
} catch (e) {
  console.warn('registerForegroundService failed', e);
}

export async function requestNotificationPermissions() {
  // System dialog (Android 13+ POST_NOTIFICATIONS + iOS)
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: true, allowCriticalAlerts: true },
    android: {},
  });
  try {
    await notifee.requestPermission();
  } catch (e) {}
  // Best-effort: direct battery-optimization dialog (needs manifest permission)
  if (Platform.OS === 'android') {
    try {
      await Linking.sendIntent(
        'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
        [{ key: 'package', value: 'com.tentry.alarmapp' }]
      );
    } catch (_) {}
  }
  return status === 'granted';
}

export async function getNotificationPermissionStatus() {
  const perm = await Notifications.getPermissionsAsync();
  return perm.status === 'granted';
}

export async function getFullScreenIntentGranted() {
  if (Platform.OS !== 'android') return true;
  try {
    const { NativeModules } = require('react-native');
    const mod = NativeModules.OverlayLauncher;
    if (mod && typeof mod.canUseFullScreenIntent === 'function') {
      return !!(await mod.canUseFullScreenIntent());
    }
  } catch (_) {}
  try {
    const settings = await notifee.getNotificationSettings();
    if (settings.android && typeof settings.android.fullScreenIntent === 'number') {
      return settings.android.fullScreenIntent === 1;
    }
    return true;
  } catch (e) {
    return true;
  }
}

/** True when battery optimization is NOT restricting this app. */
export async function isBatteryOptimizationIgnored() {
  if (Platform.OS !== 'android') return true;
  try {
    const { NativeModules } = require('react-native');
    const mod = NativeModules.OverlayLauncher;
    if (mod && typeof mod.isIgnoringBatteryOptimizations === 'function') {
      return !!(await mod.isIgnoringBatteryOptimizations());
    }
  } catch (_) {}
  try {
    // notifee: true = optimization IS enabled (bad for us)
    const restricted = await notifee.isBatteryOptimizationEnabled();
    return !restricted;
  } catch (e) {
    return false;
  }
}

/** Overlay / "Display over other apps" granted? */
export async function isOverlayPermissionGranted() {
  if (Platform.OS !== 'android') return true;
  try {
    const { NativeModules } = require('react-native');
    const mod = NativeModules.OverlayLauncher;
    if (mod && typeof mod.canDrawOverlays === 'function') {
      return !!(await mod.canDrawOverlays());
    }
  } catch (e) {}
  return false;
}

/**
 * DND / notification-policy access via NotificationManager.isNotificationPolicyAccessGranted().
 * Uses native OverlayLauncher module; falls back to notifee fields if present.
 */
export async function isDndAccessGranted() {
  if (Platform.OS !== 'android') return true;
  try {
    const { NativeModules } = require('react-native');
    const mod = NativeModules.OverlayLauncher;
    if (mod && typeof mod.isNotificationPolicyAccessGranted === 'function') {
      return !!(await mod.isNotificationPolicyAccessGranted());
    }
  } catch (_) {}
  try {
    const settings = await notifee.getNotificationSettings();
    if (settings?.android?.notificationPolicyAccess === 1) return true;
    if (settings?.android?.notificationPolicy === 1) return true;
  } catch (e) {}
  return false;
}

const APP_PACKAGE = 'com.tentry.alarmapp';

/**
 * Opens the most direct Android settings / system dialog for a permission.
 * Apps cannot flip these switches themselves (Android security) — the best we
 * can do is land the user on the exact screen/dialog so they only tap Allow.
 */
export async function openFullScreenIntentSettings() {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.openAlarmPermissionSettings();
    return;
  } catch (_) {}
  // Fallback: app notification settings (often includes full-screen intent)
  try {
    await Linking.sendIntent('android.settings.APP_NOTIFICATION_SETTINGS', [
      { key: 'android.provider.extra.APP_PACKAGE', value: APP_PACKAGE },
    ]);
    return;
  } catch (_) {}
  try {
    await Linking.openSettings();
  } catch (_) {}
}

/** Package-specific "Allow background / don't optimize" system dialog when possible. */
export async function openBatteryOptimizationSettings() {
  if (Platform.OS !== 'android') return;
  // Direct one-tap dialog for this package (needs REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
  try {
    await Linking.sendIntent('android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', [
      { key: 'package', value: APP_PACKAGE },
    ]);
    return;
  } catch (_) {}
  try {
    await Linking.openURL(
      `intent:#Intent;action=android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS;data=package:${APP_PACKAGE};end`
    );
    return;
  } catch (_) {}
  try {
    await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
    return;
  } catch (_) {}
  try {
    await Linking.openSettings();
  } catch (_) {}
}

/** Opens overlay permission for THIS app only (not the full app list) when supported. */
export async function openOverlaySettings() {
  if (Platform.OS !== 'android') return;
  try {
    await Linking.openURL(
      `intent:#Intent;action=android.settings.action.MANAGE_OVERLAY_PERMISSION;data=package:${APP_PACKAGE};end`
    );
    return;
  } catch (_) {}
  try {
    await Linking.sendIntent('android.settings.action.MANAGE_OVERLAY_PERMISSION', [
      { key: 'android.provider.extra.APP_PACKAGE', value: APP_PACKAGE },
    ]);
    return;
  } catch (_) {}
  try {
    await Linking.sendIntent('android.settings.action.MANAGE_OVERLAY_PERMISSION');
    return;
  } catch (_) {}
  try {
    await Linking.openSettings();
  } catch (_) {}
}

/**
 * DND / notification policy access. Android only exposes the full list —
 * there is no package-specific dialog. User finds "Tentry Alarm" and toggles.
 */
export async function openDndAccessSettings() {
  if (Platform.OS !== 'android') return;
  try {
    await Linking.sendIntent('android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS');
    return;
  } catch (_) {}
  try {
    await Linking.openURL(
      'intent:#Intent;action=android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS;end'
    );
    return;
  } catch (_) {}
  try {
    await Linking.openSettings();
  } catch (_) {}
}

// Data-only pushes (no top-level title/body — like your curl example) land in the
// Android background task with an inconsistent shape depending on Expo SDK / FCM
// delivery path (sometimes notification.data, sometimes notification.request.content.data,
// sometimes the raw data at the top level, occasionally JSON-stringified). Rather than
// betting on one exact path, walk the object and grab the first thing that actually
// looks like a signal payload.
function looksLikeSignalPayload(obj) {
  return (
    obj &&
    typeof obj === 'object' &&
    (obj.symbol !== undefined || obj.action !== undefined || obj.entry !== undefined)
  );
}

export function extractPushPayload(raw, depth = 0) {
  if (!raw || typeof raw !== 'object' || depth > 6) return null;
  if (looksLikeSignalPayload(raw)) return raw;
  for (const key of Object.keys(raw)) {
    const val = raw[key];
    if (val && typeof val === 'object') {
      const found = extractPushPayload(val, depth + 1);
      if (found) return found;
    } else if (typeof val === 'string' && val.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(val);
        if (looksLikeSignalPayload(parsed)) return parsed;
        const nested = extractPushPayload(parsed, depth + 1);
        if (nested) return nested;
      } catch (_) {}
    }
  }
  return null;
}

// ColorOS (Oppo/Realme/OnePlus), MIUI (Xiaomi), FunTouch (Vivo) etc. run a second,
// manufacturer-specific battery killer on top of stock Android that ignores the
// standard "ignore battery optimizations" grant. There's no public API to flip this
// programmatically (by design — it's a user-consent screen) so the best any app can
// do is deep-link straight to it. These component names are the ones the various
// ColorOS builds have shipped under; try each until one resolves.
const OEM_AUTOSTART_INTENTS = [
  'intent://#Intent;component=com.coloros.safecenter/.startupapp.StartupAppListActivity;end',
  'intent://#Intent;component=com.coloros.safecenter/com.coloros.safecenter.startupapp.StartupAppListActivity;end',
  'intent://#Intent;component=com.coloros.safecenter/com.coloros.safecenter.permission.startup.StartupAppListActivity;end',
  'intent://#Intent;component=com.coloros.phonemanager/.startupapp.StartupAppListActivity;end',
  'intent://#Intent;component=com.oppo.safe/.startupapp.StartupAppListActivity;end',
  'intent://#Intent;component=com.miui.securitycenter/com.miui.permcenter.autostart.AutoStartManagementActivity;end',
  'intent://#Intent;component=com.iqoo.secure/.ui.phoneoptimize.AddWhiteListActivity;end',
  'intent://#Intent;component=com.vivo.permissionmanager/.activity.BgStartUpManagerActivity;end',
];

/** Tries each known OEM auto-start manager screen; falls back to app settings. */
export async function openOemAutostartSettings() {
  if (Platform.OS !== 'android') return false;
  for (const uri of OEM_AUTOSTART_INTENTS) {
    try {
      await Linking.openURL(uri);
      return true;
    } catch (_) {
      // that component doesn't exist on this device/ROM — try the next one
    }
  }
  try {
    await Linking.openSettings();
  } catch (_) {}
  return false;
}

export async function createAlarmChannel() {
  if (Platform.OS !== 'android') return;

  // Loud channel kept for snooze trigger compatibility only.
  await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
    name: 'Trading Signal Alarm',
    importance: Notifications.AndroidImportance.MAX,
    sound: ALARM_SOUND_FILE,
    bypassDnd: true,
    enableVibrate: true,
    vibrationPattern: [500, 500, 500, 500, 500, 500],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.ALARM,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
    },
  });

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

  // Drop any older silent channels that may have been created with sound.
  for (const legacyId of LEGACY_ALARM_SILENT_CHANNEL_IDS) {
    try {
      await notifee.deleteChannel(legacyId);
    } catch (_) {}
  }

  // Silent high-importance channel: shows heads-up / full-screen once, no tone.
  await Notifications.setNotificationChannelAsync(ALARM_SILENT_CHANNEL_ID, {
    name: 'Trading Signal (silent)',
    importance: Notifications.AndroidImportance.HIGH,
    sound: null,
    bypassDnd: true,
    enableVibrate: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  await notifee.createChannel({
    id: ALARM_SILENT_CHANNEL_ID,
    name: 'Trading Signal (silent)',
    importance: AndroidImportance.HIGH,
    sound: undefined,
    bypassDnd: true,
    vibration: false,
    visibility: AndroidVisibility.PUBLIC,
  });
}

/** Low-importance channel for the permanent keep-alive Foreground Service. */
export async function createMonitoringChannel() {
  if (Platform.OS !== 'android') return;
  try {
    // Remove any legacy channels that may have been created with sound/vibrate
    // or SECRET visibility (which hid the notification on some OEMs).
    for (const legacyId of LEGACY_MONITORING_CHANNEL_IDS) {
      try {
        await notifee.deleteChannel(legacyId);
      } catch (_) {}
    }
    await notifee.createChannel({
      id: MONITORING_CHANNEL_ID,
      name: 'Tentry Keep-Alive',
      // LOW = status-bar icon + appears in shade, but NO sound / vibration
      importance: AndroidImportance.LOW,
      sound: undefined,
      vibration: false,
      lights: false,
      badge: false,
      // PUBLIC so it is always visible in the notification shade (SECRET hid it)
      visibility: AndroidVisibility.PUBLIC,
      bypassDnd: false,
    });
  } catch (e) {
    console.warn('createMonitoringChannel failed', e);
  }
}

/**
 * Starts the permanent Foreground Service that keeps the process alive after
 * the user swipes the app from Recents. Shows a discreet ongoing notification
 * ("Tentry Alarm – Monitoring for trading signals").
 *
 * Call this once setup is complete / on every cold start into the main UI.
 * Safe to call repeatedly — it just re-posts the same notification id.
 */
export async function startMonitoringService() {
  if (Platform.OS !== 'android') return false;
  try {
    await createMonitoringChannel();
    await notifee.displayNotification({
      id: MONITORING_NOTIFICATION_ID,
      title: 'Tentry Alarm',
      body: 'Monitoring for trading signals',
      data: { kind: 'monitoring' },
      android: {
        channelId: MONITORING_CHANNEL_ID,
        asForegroundService: true,
        // Android 14+ requires an explicit FGS type. mediaPlayback fits an
        // alarm app that may play looping audio while the service is active.
        foregroundServiceTypes: [
          AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
        ],
        ongoing: true,
        autoCancel: false,
        onlyAlertOnce: true,
        pressAction: { id: 'open-monitoring', launchActivity: 'default' },
        importance: AndroidImportance.LOW,
        visibility: AndroidVisibility.PUBLIC,
        // Explicit silence — keep-alive badge must never beep or vibrate
        sound: undefined,
        vibrationPattern: [],
        lights: false,
        lightUpScreen: false,
        smallIcon: 'notification_icon',
        color: '#22b8ff',
      },
    });
    console.log('[Tentry] monitoring FGS notification posted');
    return true;
  } catch (e) {
    console.warn('startMonitoringService failed', e);
    // Fallback: try without smallIcon / FGS type in case the icon resource
    // is missing on an older native build — still better than no keep-alive.
    try {
      await notifee.displayNotification({
        id: MONITORING_NOTIFICATION_ID,
        title: 'Tentry Alarm',
        body: 'Monitoring for trading signals',
        data: { kind: 'monitoring' },
        android: {
          channelId: MONITORING_CHANNEL_ID,
          asForegroundService: true,
          ongoing: true,
          autoCancel: false,
          onlyAlertOnce: true,
          pressAction: { id: 'open-monitoring', launchActivity: 'default' },
          importance: AndroidImportance.LOW,
          visibility: AndroidVisibility.PUBLIC,
          sound: undefined,
          vibrationPattern: [],
        },
      });
      console.log('[Tentry] monitoring FGS notification posted (fallback)');
      return true;
    } catch (e2) {
      console.warn('startMonitoringService fallback failed', e2);
      return false;
    }
  }
}

/** Stops the permanent monitoring Foreground Service and removes its notification. */
export async function stopMonitoringService() {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.cancelNotification(MONITORING_NOTIFICATION_ID);
  } catch (e) {}
  try {
    // Only stop the FGS if no alarm notification is currently the active one
    const displayed = await notifee.getDisplayedNotifications();
    const hasAlarm = displayed.some((n) => n.notification?.data?.kind === 'alarm');
    if (!hasAlarm) {
      await notifee.stopForegroundService();
    }
  } catch (e) {}
}

export async function displayAlarmNotification({ title, body, data }) {
  try {
    await createAlarmChannel();
  } catch (_) {}

  // Single silent tray notification. Sound / vibration come only from the
  // in-app expo-av engine so dismiss fully stops audio and we never get
  // 2–3 stacked system notifications with different tones.
  const payload = {
    id: 'tentry-active-alarm',
    title: title || 'Trading Signal',
    body: body || 'Signal received',
    data: { ...(data || {}), kind: 'alarm' },
    android: {
      channelId: ALARM_SILENT_CHANNEL_ID,
      category: AndroidCategory.ALARM,
      importance: AndroidImportance.HIGH,
      loopSound: false,
      sound: undefined,
      ongoing: true,
      autoCancel: false,
      onlyAlertOnce: true,
      visibility: AndroidVisibility.PUBLIC,
      fullScreenAction: { id: 'default', launchActivity: 'default' },
      pressAction: { id: 'default', launchActivity: 'default' },
      // NOT asForegroundService — Monitoring FGS already keeps the process alive
      actions: [
        { title: 'Snooze', pressAction: { id: 'snooze' } },
        { title: 'Dismiss', pressAction: { id: 'dismiss' } },
      ],
      lightUpScreen: true,
      color: '#22b8ff',
      smallIcon: 'notification_icon',
      tag: 'tentry-alarm',
      vibrationPattern: [],
    },
    ios: {
      critical: false,
      sound: undefined,
      interruptionLevel: 'timeSensitive',
    },
  };

  try {
    // Cancel any previous alarm tray item first so we never stack 2–3 copies
    await notifee.cancelNotification('tentry-active-alarm', 'tentry-alarm');
  } catch (_) {}

  try {
    await notifee.displayNotification(payload);
    console.log('[Tentry] silent alarm notification posted (once)');
  } catch (e1) {
    console.warn('[Tentry] alarm notifee with icon failed, retrying plain', e1);
    try {
      const { smallIcon, ...androidRest } = payload.android;
      await notifee.displayNotification({ ...payload, android: androidRest });
    } catch (e2) {
      console.warn('[Tentry] alarm notifee display failed', e2);
    }
  }
}

/**
 * Expo local backup — also silent, fixed id so it replaces instead of stacking.
 * Used only when notifee heads-up is suppressed on some OEMs.
 */
export async function presentExpoAlarmNotification({ title, body, data }) {
  try {
    // Cancel any previous expo-scheduled alarm so we only ever show one
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      (presented || [])
        .filter((n) => n?.request?.content?.data?.kind === 'alarm' || n?.request?.content?.data?.tentry_alarm === '1')
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier))
    );
  } catch (_) {}

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: 'tentry-active-alarm-expo',
      content: {
        title: title || 'Trading Signal',
        body: body || 'Signal received',
        sound: false,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        sticky: true,
        autoDismiss: false,
        data: { ...(data || {}), kind: 'alarm', tentry_alarm: '1' },
        ...(Platform.OS === 'android'
          ? { channelId: ALARM_SILENT_CHANNEL_ID }
          : {}),
      },
      trigger: null, // immediate
    });
  } catch (e) {
    console.warn('[Tentry] expo local alarm notif failed', e);
  }
}

/**
 * Signal alerts: NO tray notification by design.
 * User hears the in-app alarm only. Monitoring FGS stays the only ongoing silent badge.
 * displayAlarmNotification / presentExpoAlarmNotification remain available if we need them later.
 */
export async function presentAlarmNotification({ title, body, data }) {
  // Intentionally no-op — do not post notifee or expo tray for signals.
  // Audio + UI card are driven solely by startRinging / AlarmRingScreen.
  console.log('[Tentry] presentAlarmNotification skipped (ring-only mode)', title);
}

export async function stopAlarmNotification({ restartMonitoring = true } = {}) {
  // Cancel fixed-id alarm tray items (with and without tag)
  try {
    await notifee.cancelNotification('tentry-active-alarm', 'tentry-alarm');
  } catch (e) {}
  try {
    await notifee.cancelNotification('tentry-active-alarm');
  } catch (e) {}
  try {
    await notifee.cancelAllNotifications(); // safe: we immediately re-post monitoring
  } catch (e) {}
  try {
    const displayed = await notifee.getDisplayedNotifications();
    await Promise.all(
      (displayed || []).map((n) =>
        notifee
          .cancelNotification(n.id, n.notification?.android?.tag)
          .catch(() => notifee.cancelNotification(n.id).catch(() => {}))
      )
    );
  } catch (e) {}
  try {
    // Clear expo-scheduled / presented alarm copies too
    await Notifications.dismissNotificationAsync('tentry-active-alarm-expo');
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      (presented || []).map((n) =>
        Notifications.dismissNotificationAsync(n.request.identifier).catch(() => {})
      )
    );
  } catch (e) {}
  // Cancel any pending trigger (snooze) notifications so a loud channel never fires later
  try {
    const triggers = await notifee.getTriggerNotifications();
    await Promise.all(
      (triggers || []).map((t) => {
        const id = t?.notification?.id;
        return id ? notifee.cancelTriggerNotification(id).catch(() => {}) : Promise.resolve();
      })
    );
  } catch (e) {}

  // Re-assert the permanent keep-alive FGS so the process stays privileged.
  // Monitoring is the ONLY notification that must remain; it is always silent.
  if (restartMonitoring && Platform.OS === 'android') {
    setTimeout(() => {
      startMonitoringService().catch(() => {});
    }, 350);
  }
}

export { EventType };

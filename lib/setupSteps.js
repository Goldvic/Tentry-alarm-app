import { Platform, Linking } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import {
  createAlarmChannel,
  requestNotificationPermissions,
  openFullScreenIntentSettings,
  openOemAutostartSettings,
  isBatteryOptimizationIgnored,
  isOverlayPermissionGranted,
  isDndAccessGranted,
  getFullScreenIntentGranted,
} from './notifications';
import { KEYS, setString } from './storage';

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export function buildSteps({ onPushToken }) {
  const steps = [
    {
      key: 'notifications',
      kind: 'auto',
      icon: 'notifications',
      title: 'Notification Permission',
      description: 'Required so the app can alert you the instant your Entry Bot sends a signal.',
      run: async () => requestNotificationPermissions(),
    },
    {
      key: 'channel',
      kind: 'auto',
      icon: 'radio',
      title: 'Alarm Channel Setup',
      description: 'Creates a dedicated high-priority channel that can ring through silent mode at full volume.',
      run: async () => {
        await createAlarmChannel();
        return true;
      },
    },
  ];

  if (Platform.OS === 'android') {
    steps.push(
      {
        key: 'dnd',
        kind: 'external',
        icon: 'moon',
        title: 'Do Not Disturb Access',
        description:
          'Settings opens automatically. Find “Tentry Alarm” in the list and turn the switch ON. When you return, the app checks automatically — no extra tap needed.',
        autoOpen: true,
        openSettings: async () => {
          const { openDndAccessSettings } = require('./notifications');
          await openDndAccessSettings();
        },
        checkGranted: async () => {
          try {
            return await isDndAccessGranted();
          } catch (_) {
            return false;
          }
        },
        // If native check fails on a ROM but user enabled the switch, Continue still works
        softSkipOnReturn: false,
      },
      {
        key: 'overlay',
        kind: 'external',
        icon: 'layers',
        title: 'Display Over Other Apps',
        description:
          'Settings opens on this app’s page. Tap Allow so the alarm card can appear over other apps. When you return, the app checks automatically.',
        autoOpen: true,
        openSettings: async () => {
          const { openOverlaySettings } = require('./notifications');
          await openOverlaySettings();
        },
        checkGranted: async () => {
          try {
            return await isOverlayPermissionGranted();
          } catch (_) {
            return false;
          }
        },
      },
      {
        key: 'battery',
        kind: 'external',
        icon: 'battery-charging',
        title: 'Battery Optimization',
        description:
          'A system dialog opens for this app. Tap Allow / Don’t optimize so Android does not kill the alarm in the background. When you return, the app checks automatically.',
        autoOpen: true,
        openSettings: async () => {
          const { openBatteryOptimizationSettings } = require('./notifications');
          await openBatteryOptimizationSettings();
        },
        checkGranted: async () => {
          try {
            return await isBatteryOptimizationIgnored();
          } catch (_) {
            return false;
          }
        },
        softSkipOnReturn: false,
      },
      {
        key: 'oem_autostart',
        kind: 'external',
        icon: 'rocket',
        title: 'Auto-Start / Startup Manager (Oppo, Xiaomi, Vivo...)',
        description:
          'On ColorOS / MIUI / FunTouch the phone opens its Startup list when possible. Turn ON Tentry Alarm (or Allow background / No restrictions). Then return — the app will continue. Lock the app in Recents if your phone shows a lock icon.',
        autoOpen: true,
        // OEM screens have no public API to verify; always treat return as success after user confirms via auto-advance fallback
        openSettings: async () => {
          await openOemAutostartSettings();
        },
        checkGranted: async () => false, // cannot verify — onboarding will still auto-advance on return with a soft message
        softSkipOnReturn: true,
      },
      {
        key: 'fullscreen',
        kind: 'external',
        icon: 'expand',
        title: 'Full-Screen Alarm (Android 14+)',
        description:
          'If a permission screen opens, turn full-screen alarms ON for Tentry Alarm. When you return, the app checks automatically. On older Android nothing may open — that is fine.',
        autoOpen: true,
        openSettings: async () => {
          try {
            await openFullScreenIntentSettings();
          } catch (e) {
            await Linking.openSettings();
          }
        },
        checkGranted: async () => {
          try {
            return await getFullScreenIntentGranted();
          } catch (_) {
            return true; // older Android / unknown → treat as ok
          }
        },
        // Pre-API 34 always true; on 14+ Continue still works if check lags
        softSkipOnReturn: false,
      }
    );
  }

  steps.push({
    key: 'pushtoken',
    kind: 'auto',
    icon: 'phone-portrait',
    title: 'Registering This Device',
    description: 'Generates the Expo push token your Entry Bot uses to target this exact phone.',
    run: async () => {
      if (!Device.isDevice) {
        throw new Error('Push tokens only work on a real device, not an emulator/simulator.');
      }
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const tokenResponse = await withTimeout(
        Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined),
        15000,
        'Timed out waiting for a push token. Check your internet connection and try again.'
      );
      onPushToken && onPushToken(tokenResponse.data);
      await setString(KEYS.PUSH_TOKEN, tokenResponse.data);
      return true;
    },
  });

  return steps;
}

import { Platform, Linking } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import {
  createAlarmChannel,
  requestNotificationPermissions,
  openFullScreenIntentSettings,
} from './notifications';
import { KEYS, setString } from './storage';

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

// "auto" steps run themselves with no user gesture needed beyond the OS
// permission dialog. "external" steps navigate the user to a system
// Settings screen — those can ONLY be safely re-entered by a direct user
// tap (Android blocks apps from launching activities while backgrounded).
export function buildSteps({ onPushToken }) {
  const steps = [
    {
      key: 'notifications',
      kind: 'auto',
      icon: 'notifications',
      title: 'Notification Permission',
      description: 'Required so the app can alert you the instant your bot sends a signal.',
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
          'Android requires a manual toggle to let this app bypass silent/DND mode. Tap below, enable "Tentry Alarm", then come back and press Continue.',
        openSettings: async () => {
          try {
            await Linking.sendIntent('android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS');
          } catch (e) {
            await Linking.openSettings();
          }
        },
      },
      {
        key: 'overlay',
        kind: 'external',
        icon: 'layers',
        title: 'Display Over Other Apps',
        description:
          'Lets the ringing card appear on top of whatever app you\'re in — not just as a notification banner. Find "Tentry Alarm" in the list, allow it, then come back and press Continue.',
        openSettings: async () => {
          try {
            await Linking.sendIntent('android.settings.action.MANAGE_OVERLAY_PERMISSION');
          } catch (e) {
            await Linking.openSettings();
          }
        },
      },
      {
        key: 'battery',
        kind: 'external',
        icon: 'battery-charging',
        title: 'Battery Optimization',
        description:
          'Disabling battery optimization stops Android from killing the app in the background, so alarms still ring after your phone has been idle. Choose "Allow" / "Don\'t optimize", then come back and press Continue.',
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
        key: 'fullscreen',
        kind: 'external',
        icon: 'expand',
        title: 'Full-Screen Alarm (Android 14+)',
        description:
          'Newer Android versions added a separate switch for full-screen alarm cards. If your phone shows one, turn it on for Tentry Alarm — on older Android this screen may not appear and that\'s fine, just press Continue.',
        openSettings: async () => {
          try {
            await openFullScreenIntentSettings();
          } catch (e) {
            await Linking.openSettings();
          }
        },
      }
    );
  }

  steps.push({
    key: 'pushtoken',
    kind: 'auto',
    icon: 'phone-portrait',
    title: 'Registering This Device',
    description: 'Generates the push token your relay server uses to target this exact phone.',
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

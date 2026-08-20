import { NativeModules, Platform } from 'react-native';

const { OverlayLauncher } = NativeModules;

/**
 * Attempts to bring the app to the foreground directly from a background context
 * (the headless background notification task), instead of waiting for the user
 * to tap the notification.
 *
 * Requires "Display over other apps" to already be granted (requested in the
 * onboarding "overlay" step). If it isn't granted, or the native module isn't
 * present for any reason (e.g. running in Expo Go, where custom native modules
 * aren't available), this safely resolves to false — the existing notification
 * (heads-up banner, or full-screen intent when locked) still covers you.
 */
export async function launchAppOverlay() {
  if (Platform.OS !== 'android' || !OverlayLauncher || !OverlayLauncher.launchApp) {
    return false;
  }
  try {
    return await OverlayLauncher.launchApp();
  } catch (e) {
    console.warn('[Tentry] overlay auto-launch failed:', e);
    return false;
  }
}

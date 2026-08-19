// Small wrapper around AsyncStorage so every screen uses the same keys
// and JSON parsing doesn't get duplicated everywhere.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  ALARM_URI: 'alarm_music_uri',
  RELAY_URL: 'relay_url',
  WEBHOOK_SECRET: 'webhook_secret',
  SIGNAL_HISTORY: 'signal_history',
  SETUP_RESULTS: 'setup_results',
  KEEP_AWAKE: 'keep_awake_enabled',
  PUSH_TOKEN: 'push_token',

  // v4 additions
  UI_SCALE: 'ui_scale', // 'small' | 'medium' | 'large' | 'xl'
  ACCENT: 'accent_color', // key into THEME.accents
  ALARM_VOLUME: 'alarm_volume', // 0..1, only used if FORCE_MAX_VOLUME is off
  FORCE_MAX_VOLUME: 'force_max_volume', // boolean
  SNOOZE_MINUTES: 'snooze_minutes', // number
  AUTO_DISMISS_MINUTES: 'auto_dismiss_minutes', // number, 0 = never
  VIBRATION_PATTERN: 'vibration_pattern', // 'pulse' | 'sos' | 'long' | 'off'
};

export async function getJSON(key, fallback = null) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

export async function setJSON(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

export async function getString(key, fallback = '') {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? fallback : raw;
  } catch (e) {
    return fallback;
  }
}

export async function setString(key, value) {
  try {
    await AsyncStorage.setItem(key, value);
    return true;
  } catch (e) {
    return false;
  }
}

// Keeps the last N signals so the dashboard can show recent activity.
export async function pushSignalHistory(entry, max = 30) {
  const current = (await getJSON(KEYS.SIGNAL_HISTORY, [])) || [];
  const next = [entry, ...current].slice(0, max);
  await setJSON(KEYS.SIGNAL_HISTORY, next);
  return next;
}

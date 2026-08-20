// Small wrapper around AsyncStorage so every screen uses the same keys
// and JSON parsing doesn't get duplicated everywhere.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  ALARM_URI: 'alarm_music_uri',
  SIGNAL_HISTORY: 'signal_history',
  ALARM_HISTORY: 'alarm_history', // every time the alarm actually rang
  NOTIFICATION_LOG: 'notification_log', // every push received
  SETUP_RESULTS: 'setup_results',
  KEEP_AWAKE: 'keep_awake_enabled',
  PUSH_TOKEN: 'push_token',
  GOOGLE_EMAIL: 'google_email',
  USER_SETTINGS_PREFIX: 'user_settings_', // + email for per-account settings

  // Settings
  UI_SCALE: 'ui_scale', // 'small' | 'medium' | 'large' | 'xl'
  ACCENT: 'accent_color', // key into THEME.accents
  ALARM_VOLUME: 'alarm_volume', // 0..1, only used if FORCE_MAX_VOLUME is off
  FORCE_MAX_VOLUME: 'force_max_volume', // boolean
  SNOOZE_MINUTES: 'snooze_minutes', // number
  AUTO_DISMISS_MINUTES: 'auto_dismiss_minutes', // number, 0 = never
  VIBRATION_PATTERN: 'vibration_pattern', // 'pulse' | 'sos' | 'long' | 'off'
  CLOCK_FORMAT: 'clock_format', // '12h' | '24h'
  QUIET_HOURS_START: 'quiet_hours_start', // 'HH:mm' or ''
  QUIET_HOURS_END: 'quiet_hours_end',
  NOTIF_VIBRATION: 'notif_vibration', // boolean
  ACTIVE_ALARM: 'active_alarm_payload', // last ringing signal for UI restore
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

export async function removeKey(key) {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (e) {
    return false;
  }
}

// Keeps the last N signals so the dashboard / Signals tab can show recent activity.
export async function pushSignalHistory(entry, max = 100) {
  const current = (await getJSON(KEYS.SIGNAL_HISTORY, [])) || [];
  const next = [entry, ...current].slice(0, max);
  await setJSON(KEYS.SIGNAL_HISTORY, next);
  return next;
}

// Every time the alarm actually starts ringing.
export async function pushAlarmHistory(entry, max = 200) {
  const current = (await getJSON(KEYS.ALARM_HISTORY, [])) || [];
  const next = [entry, ...current].slice(0, max);
  await setJSON(KEYS.ALARM_HISTORY, next);
  return next;
}

// Complete log of every push notification received.
export async function pushNotificationLog(entry, max = 200) {
  const current = (await getJSON(KEYS.NOTIFICATION_LOG, [])) || [];
  const next = [entry, ...current].slice(0, max);
  await setJSON(KEYS.NOTIFICATION_LOG, next);
  return next;
}

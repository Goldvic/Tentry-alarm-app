import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as KeepAwake from 'expo-keep-awake';
import { KEYS, getJSON, getString, setJSON, setString } from '../lib/storage';
import { ACCENTS, SCALE_STEPS } from '../lib/theme';

const DEFAULTS = {
  uiScale: 'small',
  accent: 'ice',
  forceMaxVolume: true,
  alarmVolume: 1,
  snoozeMinutes: 5,
  autoDismissMinutes: 2,
  vibrationPattern: 'pulse',
  keepAwake: false,
  clockFormat: '24h',
  quietHoursStart: '',
  quietHoursEnd: '',
  notifVibration: true,
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [loaded, setLoaded] = useState(false);
  const [uiScale, setUiScaleState] = useState(DEFAULTS.uiScale);
  const [accent, setAccentState] = useState(DEFAULTS.accent);
  const [forceMaxVolume, setForceMaxVolumeState] = useState(DEFAULTS.forceMaxVolume);
  const [alarmVolume, setAlarmVolumeState] = useState(DEFAULTS.alarmVolume);
  const [snoozeMinutes, setSnoozeMinutesState] = useState(DEFAULTS.snoozeMinutes);
  const [autoDismissMinutes, setAutoDismissMinutesState] = useState(DEFAULTS.autoDismissMinutes);
  const [vibrationPattern, setVibrationPatternState] = useState(DEFAULTS.vibrationPattern);
  const [keepAwake, setKeepAwakeState] = useState(DEFAULTS.keepAwake);
  const [clockFormat, setClockFormatState] = useState(DEFAULTS.clockFormat);
  const [quietHoursStart, setQuietHoursStartState] = useState(DEFAULTS.quietHoursStart);
  const [quietHoursEnd, setQuietHoursEndState] = useState(DEFAULTS.quietHoursEnd);
  const [notifVibration, setNotifVibrationState] = useState(DEFAULTS.notifVibration);
  const [googleEmail, setGoogleEmailState] = useState(null);

  useEffect(() => {
    (async () => {
      setUiScaleState(await getString(KEYS.UI_SCALE, DEFAULTS.uiScale));
      setAccentState(await getString(KEYS.ACCENT, DEFAULTS.accent));
      setForceMaxVolumeState(await getJSON(KEYS.FORCE_MAX_VOLUME, DEFAULTS.forceMaxVolume));
      setAlarmVolumeState(await getJSON(KEYS.ALARM_VOLUME, DEFAULTS.alarmVolume));
      setSnoozeMinutesState(await getJSON(KEYS.SNOOZE_MINUTES, DEFAULTS.snoozeMinutes));
      setAutoDismissMinutesState(await getJSON(KEYS.AUTO_DISMISS_MINUTES, DEFAULTS.autoDismissMinutes));
      setVibrationPatternState(await getString(KEYS.VIBRATION_PATTERN, DEFAULTS.vibrationPattern));
      const ka = await getJSON(KEYS.KEEP_AWAKE, DEFAULTS.keepAwake);
      setKeepAwakeState(!!ka);
      if (ka) KeepAwake.activateKeepAwakeAsync();
      setClockFormatState(await getString(KEYS.CLOCK_FORMAT, DEFAULTS.clockFormat));
      setQuietHoursStartState(await getString(KEYS.QUIET_HOURS_START, DEFAULTS.quietHoursStart));
      setQuietHoursEndState(await getString(KEYS.QUIET_HOURS_END, DEFAULTS.quietHoursEnd));
      setNotifVibrationState(await getJSON(KEYS.NOTIF_VIBRATION, DEFAULTS.notifVibration));
      setGoogleEmailState(await getString(KEYS.GOOGLE_EMAIL, null) || null);
      setLoaded(true);
    })();
  }, []);

  const setUiScale = useCallback(async (v) => {
    setUiScaleState(v);
    await setString(KEYS.UI_SCALE, v);
  }, []);

  const setAccent = useCallback(async (v) => {
    setAccentState(v);
    await setString(KEYS.ACCENT, v);
  }, []);

  const setForceMaxVolume = useCallback(async (v) => {
    setForceMaxVolumeState(v);
    await setJSON(KEYS.FORCE_MAX_VOLUME, v);
  }, []);

  const setAlarmVolume = useCallback(async (v) => {
    setAlarmVolumeState(v);
    await setJSON(KEYS.ALARM_VOLUME, v);
  }, []);

  const setSnoozeMinutes = useCallback(async (v) => {
    setSnoozeMinutesState(v);
    await setJSON(KEYS.SNOOZE_MINUTES, v);
  }, []);

  const setAutoDismissMinutes = useCallback(async (v) => {
    setAutoDismissMinutesState(v);
    await setJSON(KEYS.AUTO_DISMISS_MINUTES, v);
  }, []);

  const setVibrationPattern = useCallback(async (v) => {
    setVibrationPatternState(v);
    await setString(KEYS.VIBRATION_PATTERN, v);
  }, []);

  const setKeepAwake = useCallback(async (v) => {
    setKeepAwakeState(v);
    await setJSON(KEYS.KEEP_AWAKE, v);
    if (v) {
      KeepAwake.activateKeepAwakeAsync();
    } else {
      KeepAwake.deactivateKeepAwake();
    }
  }, []);

  const setClockFormat = useCallback(async (v) => {
    setClockFormatState(v);
    await setString(KEYS.CLOCK_FORMAT, v);
  }, []);

  const setQuietHoursStart = useCallback(async (v) => {
    setQuietHoursStartState(v);
    await setString(KEYS.QUIET_HOURS_START, v);
  }, []);

  const setQuietHoursEnd = useCallback(async (v) => {
    setQuietHoursEndState(v);
    await setString(KEYS.QUIET_HOURS_END, v);
  }, []);

  const setNotifVibration = useCallback(async (v) => {
    setNotifVibrationState(v);
    await setJSON(KEYS.NOTIF_VIBRATION, v);
  }, []);

  const setGoogleEmail = useCallback(async (email) => {
    setGoogleEmailState(email);
    if (email) await setString(KEYS.GOOGLE_EMAIL, email);
    else await setString(KEYS.GOOGLE_EMAIL, '');
  }, []);

  const scale = useCallback(
    (base) => Math.round(base * (SCALE_STEPS[uiScale] || 1)),
    [uiScale]
  );

  const accentTokens = ACCENTS[accent] || ACCENTS.signal;

  const value = useMemo(
    () => ({
      loaded,
      uiScale,
      setUiScale,
      scale,
      accent,
      setAccent,
      accentTokens,
      forceMaxVolume,
      setForceMaxVolume,
      alarmVolume,
      setAlarmVolume,
      snoozeMinutes,
      setSnoozeMinutes,
      autoDismissMinutes,
      setAutoDismissMinutes,
      vibrationPattern,
      setVibrationPattern,
      keepAwake,
      setKeepAwake,
      clockFormat,
      setClockFormat,
      quietHoursStart,
      setQuietHoursStart,
      quietHoursEnd,
      setQuietHoursEnd,
      notifVibration,
      setNotifVibration,
      googleEmail,
      setGoogleEmail,
    }),
    [
      loaded,
      uiScale,
      scale,
      accent,
      accentTokens,
      forceMaxVolume,
      alarmVolume,
      snoozeMinutes,
      autoDismissMinutes,
      vibrationPattern,
      keepAwake,
      clockFormat,
      quietHoursStart,
      quietHoursEnd,
      notifVibration,
      googleEmail,
      setUiScale,
      setAccent,
      setForceMaxVolume,
      setAlarmVolume,
      setSnoozeMinutes,
      setAutoDismissMinutes,
      setVibrationPattern,
      setKeepAwake,
      setClockFormat,
      setQuietHoursStart,
      setQuietHoursEnd,
      setNotifVibration,
      setGoogleEmail,
    ]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}

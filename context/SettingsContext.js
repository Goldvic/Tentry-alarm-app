import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as KeepAwake from 'expo-keep-awake';
import { KEYS, getJSON, getString, setJSON, setString } from '../lib/storage';
import { ACCENTS, SCALE_STEPS } from '../lib/theme';

const DEFAULTS = {
  uiScale: 'medium',
  accent: 'ice', // matches the new cyan-to-purple icon artwork
  forceMaxVolume: true,
  alarmVolume: 1,
  snoozeMinutes: 5,
  autoDismissMinutes: 2,
  vibrationPattern: 'pulse',
  keepAwake: false,
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

  // scale(baseSize) -> baseSize adjusted for the current Display size
  // setting. Used for every font size AND icon size in the app so the
  // "adjustable icon size" request applies everywhere consistently
  // instead of each screen inventing its own math.
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
      setUiScale,
      setAccent,
      setForceMaxVolume,
      setAlarmVolume,
      setSnoozeMinutes,
      setAutoDismissMinutes,
      setVibrationPattern,
      setKeepAwake,
    ]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}

import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, AppState } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Card from '../components/Card';
import ScaledText from '../components/ScaledText';
import ScaledIcon from '../components/ScaledIcon';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { useSettings } from '../context/SettingsContext';
import { buildSteps } from '../lib/setupSteps';
import { KEYS, getJSON, setJSON } from '../lib/storage';
import { COLORS } from '../lib/theme';

export default function OnboardingScreen({ onComplete, onPushToken, resume = true }) {
  const { accentTokens } = useSettings();
  const steps = useRef(buildSteps({ onPushToken })).current;

  const [stepIndex, setStepIndex] = useState(0);
  const [results, setResults] = useState({});
  const [awaitingReturn, setAwaitingReturn] = useState(false);
  const [stepRunning, setStepRunning] = useState(false);
  const [stepError, setStepError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [permissionMsg, setPermissionMsg] = useState(null);
  const [checking, setChecking] = useState(false);

  const appState = useRef(AppState.currentState);
  const pendingExternalStep = useRef(null);
  const resultsRef = useRef(results);
  resultsRef.current = results;

  useEffect(() => {
    (async () => {
      if (resume) {
        const saved = (await getJSON(KEYS.SETUP_RESULTS, null)) || {};
        setResults(saved);
        const resumeIndex = steps.findIndex((s) => !saved[s.key]);
        setStepIndex(resumeIndex === -1 ? steps.length - 1 : resumeIndex);
      }
      setReady(true);
    })();
  }, []);

  const persistResults = async (next) => {
    setResults(next);
    resultsRef.current = next;
    await setJSON(KEYS.SETUP_RESULTS, next);
  };

  const advanceFromExternal = async (stepKey) => {
    const next = { ...resultsRef.current, [stepKey]: true };
    await persistResults(next);
    pendingExternalStep.current = null;
    setAwaitingReturn(false);
    setPermissionMsg(null);
    setStepError(null);
    setStepIndex((i) => i + 1);
  };

  /** After user returns from system settings: auto-check permission and advance if granted. */
  const tryAutoAdvanceExternal = async (stepKey) => {
    const step = steps.find((s) => s.key === stepKey);
    if (!step || step.kind !== 'external') return;

    setChecking(true);
    setPermissionMsg(null);

    // Give the OS time to persist the grant after the settings activity closes
    await new Promise((r) => setTimeout(r, 600));

    let granted = false;
    try {
      if (typeof step.checkGranted === 'function') {
        granted = !!(await step.checkGranted());
        // Retry once — some OEMs lag on policy access flag
        if (!granted) {
          await new Promise((r) => setTimeout(r, 500));
          granted = !!(await step.checkGranted());
        }
      }
    } catch (_) {
      granted = false;
    }

    // OEM autostart (and similar) cannot be verified — soft-skip on return
    if (!granted && step.softSkipOnReturn) {
      granted = true;
    }

    setChecking(false);

    if (granted) {
      await advanceFromExternal(stepKey);
    } else {
      setAwaitingReturn(true);
      setPermissionMsg(
        'Not detected yet. If the switch is already ON, tap “I’ve enabled it — Continue”. Otherwise open settings again.'
      );
    }
  };

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const cameBack = appState.current.match(/inactive|background/) && next === 'active';
      appState.current = next;
      if (cameBack && pendingExternalStep.current) {
        const key = pendingExternalStep.current;
        // Auto-check; no "I've done it" button required
        tryAutoAdvanceExternal(key);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const step = steps[stepIndex];
    if (!step) {
      onComplete && onComplete();
      return;
    }
    if (step.kind === 'auto') {
      let cancelled = false;
      setStepError(null);
      setPermissionMsg(null);
      setStepRunning(true);
      const t = setTimeout(async () => {
        try {
          const ok = await step.run();
          if (cancelled) return;
          await persistResults({ ...resultsRef.current, [step.key]: ok });
          setStepRunning(false);
          setStepIndex((i) => i + 1);
        } catch (e) {
          if (cancelled) return;
          setStepRunning(false);
          setStepError({ key: step.key, message: e?.message || String(e) });
        }
      }, 200);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }
    // External steps: open the system screen automatically so user only taps Allow
    if (step.kind === 'external' && step.autoOpen && typeof step.openSettings === 'function') {
      let cancelled = false;
      pendingExternalStep.current = step.key;
      setAwaitingReturn(false);
      setPermissionMsg(null);
      const t = setTimeout(() => {
        if (cancelled) return;
        step.openSettings().catch(() => {});
      }, 450);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }
  }, [ready, stepIndex, retryCount]);

  const step = steps[stepIndex];
  if (!ready || !step) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator color={COLORS.dim} />
      </View>
    );
  }

  const errorHere = stepError && stepError.key === step.key ? stepError : null;

  const onOpenExternal = async () => {
    pendingExternalStep.current = step.key;
    setAwaitingReturn(false);
    setPermissionMsg(null);
    await step.openSettings();
  };

  // Manual continue: re-check, but never permanently trap the user.
  // If they opened Settings and say they enabled it, trust them after one retry.
  const onAdvance = async () => {
    setChecking(true);
    setPermissionMsg(null);
    let granted = false;
    try {
      if (typeof step.checkGranted === 'function') {
        // Small delay so OS has flushed the grant
        await new Promise((r) => setTimeout(r, 300));
        granted = !!(await step.checkGranted());
      }
    } catch (_) {
      granted = false;
    }
    setChecking(false);

    if (granted || step.softSkipOnReturn) {
      await advanceFromExternal(step.key);
      return;
    }

    // User already went to Settings and claims enabled — allow continue so setup cannot soft-lock
    if (awaitingReturn || permissionMsg) {
      await advanceFromExternal(step.key);
      return;
    }

    setPermissionMsg('Permission not yet granted. Enable it in Settings, then return — or tap Continue after enabling.');
    setAwaitingReturn(true);
  };

  const onRetry = () => {
    setStepError(null);
    setRetryCount((c) => c + 1);
  };

  return (
    <View className="flex-1 bg-bg items-center justify-center px-5">
      <View style={{ width: '100%', maxWidth: 440 }}>
        <View className="items-center mb-8">
          <LinearGradient
            colors={[accentTokens.from, accentTokens.to]}
            style={{ width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}
          >
            <ScaledIcon name={step.icon || 'flash'} size={30} color="#fff" />
          </LinearGradient>
          <ScaledText size={22} weight="800" color={COLORS.text}>
            Tentry Alarm
          </ScaledText>
          <View className="flex-row mt-4">
            {steps.map((s, i) => (
              <View
                key={s.key}
                style={{
                  width: 22,
                  height: 4,
                  borderRadius: 2,
                  marginHorizontal: 2,
                  backgroundColor: i <= stepIndex ? accentTokens.from : COLORS.border,
                }}
              />
            ))}
          </View>
        </View>

        <Card>
          <ScaledText size={12} color={COLORS.faint} style={{ marginBottom: 4 }}>
            Step {stepIndex + 1} of {steps.length}
          </ScaledText>
          <ScaledText size={18} weight="700" color={COLORS.text} style={{ marginBottom: 8 }}>
            {step.title}
          </ScaledText>
          <ScaledText size={14} color={COLORS.dim} style={{ lineHeight: 20 }}>
            {step.description}
          </ScaledText>

          {step.kind === 'external' && (
            <View style={{ marginTop: 16, gap: 10 }}>
              {checking ? (
                <View className="flex-row items-center" style={{ marginBottom: 4 }}>
                  <ActivityIndicator color={COLORS.dim} />
                  <ScaledText size={13} color={COLORS.faint} style={{ marginLeft: 10 }}>
                    Checking permission…
                  </ScaledText>
                </View>
              ) : null}

              {permissionMsg ? (
                <ScaledText size={13} color={COLORS.warn} style={{ lineHeight: 18, marginBottom: 4 }}>
                  {permissionMsg}
                </ScaledText>
              ) : null}

              <PrimaryButton
                label={awaitingReturn || permissionMsg ? 'Open settings again' : 'Open settings'}
                onPress={onOpenExternal}
              />

              {/* Fallback only — primary path is auto-advance on return */}
              {(awaitingReturn || permissionMsg) && (
                <SecondaryButton
                  label="I've enabled it — Continue"
                  onPress={onAdvance}
                  disabled={checking}
                />
              )}

              <ScaledText size={12} color={COLORS.faint} style={{ marginTop: 2, lineHeight: 16 }}>
                {permissionMsg
                  ? 'Enable the permission, then come back. We check automatically.'
                  : awaitingReturn
                    ? 'Waiting for you to enable the permission…'
                    : 'Settings will open automatically. Just tap Allow / enable the switch — we detect it when you return.'}
              </ScaledText>
            </View>
          )}

          {step.kind === 'auto' && (
            <View style={{ marginTop: 16 }}>
              {errorHere ? (
                <>
                  <ScaledText size={13} color={COLORS.warn} style={{ marginBottom: 10, lineHeight: 18 }}>
                    {errorHere.message}
                  </ScaledText>
                  <PrimaryButton label="Retry" onPress={onRetry} />
                </>
              ) : (
                <View className="flex-row items-center">
                  <ActivityIndicator color={COLORS.dim} />
                  <ScaledText size={13} color={COLORS.faint} style={{ marginLeft: 10 }}>
                    {stepRunning ? 'Working…' : 'Starting…'}
                  </ScaledText>
                </View>
              )}
            </View>
          )}
        </Card>
      </View>
    </View>
  );
}

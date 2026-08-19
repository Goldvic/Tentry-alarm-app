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

  const appState = useRef(AppState.currentState);
  const pendingExternalStep = useRef(null);

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

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const cameBack = appState.current.match(/inactive|background/) && next === 'active';
      appState.current = next;
      if (cameBack && pendingExternalStep.current) {
        setAwaitingReturn(true);
      }
    });
    return () => sub.remove();
  }, []);

  const persistResults = async (next) => {
    setResults(next);
    await setJSON(KEYS.SETUP_RESULTS, next);
  };

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
      setStepRunning(true);
      const t = setTimeout(async () => {
        try {
          const ok = await step.run();
          if (cancelled) return;
          await persistResults({ ...results, [step.key]: ok });
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
    await step.openSettings();
  };

  const onAdvance = async () => {
    await persistResults({ ...results, [step.key]: true });
    pendingExternalStep.current = null;
    setAwaitingReturn(false);
    setStepError(null);
    setStepIndex((i) => i + 1);
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
              <PrimaryButton label={awaitingReturn ? 'Open Settings Again' : 'Open Settings'} onPress={onOpenExternal} />
              <SecondaryButton label="I've done this — Continue" onPress={onAdvance} disabled={!awaitingReturn} />
              {!awaitingReturn && (
                <ScaledText size={12} color={COLORS.faint} style={{ marginTop: 2, lineHeight: 16 }}>
                  Continue unlocks once you've opened Settings and come back.
                </ScaledText>
              )}
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

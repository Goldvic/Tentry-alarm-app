import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, Modal, StatusBar, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import ScaledText from '../components/ScaledText';
import ScaledIcon from '../components/ScaledIcon';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { useSettings } from '../context/SettingsContext';
import { COLORS, SPACE, RADIUS } from '../lib/theme';

export default function AlarmRingScreen({ visible, signal, onSnooze, onDismiss, snoozeMinutes }) {
  const { accentTokens } = useSettings();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible]);

  if (!visible) return null;

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  const action = String(signal?.action || '').toUpperCase();
  const isBuy = action === 'BUY' || action === 'LONG';
  const isSell = action === 'SELL' || action === 'SHORT';
  const sideColor = isBuy ? COLORS.buy : isSell ? COLORS.sell : accentTokens.from;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent presentationStyle="fullScreen">
      <StatusBar hidden />
      <LinearGradient colors={['#05070d', '#0c0f1c', '#05070d']} style={{ flex: 1 }}>
        <View style={styles.wrap}>
          <View style={styles.top}>
            <ScaledText size={12} weight="700" color={COLORS.faint} style={{ letterSpacing: 3 }}>
              TENTRY SIGNAL
            </ScaledText>
            <ScaledText size={14} color={COLORS.dim} style={{ marginTop: SPACE.sm }}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </ScaledText>
          </View>

          <View style={styles.center}>
            <View style={styles.ringBox}>
              <Animated.View
                style={[
                  styles.pulse,
                  {
                    backgroundColor: sideColor,
                    opacity: ringOpacity,
                    transform: [{ scale: ringScale }],
                  },
                ]}
              />
              <LinearGradient
                colors={[accentTokens.from, accentTokens.to]}
                style={styles.ringCore}
              >
                <ScaledIcon name="alarm" size={48} color="#fff" />
              </LinearGradient>
            </View>

            {signal?.symbol ? (
              <ScaledText size={28} weight="800" color={COLORS.white} style={{ textAlign: 'center' }}>
                {signal.symbol}
              </ScaledText>
            ) : null}

            {action ? (
              <View style={[styles.sideChip, { backgroundColor: sideColor + '33' }]}>
                <ScaledText size={15} weight="800" color={sideColor}>
                  {action}
                </ScaledText>
              </View>
            ) : null}

            <ScaledText size={14} color={COLORS.dim} style={styles.message}>
              {signal?.message || 'Signal received from your Tentry bot'}
            </ScaledText>
          </View>

          <View style={styles.actions}>
            <PrimaryButton
              label={`Snooze ${snoozeMinutes} min`}
              onPress={onSnooze}
              icon={<ScaledIcon name="time" size={16} color="#fff" />}
            />
            <View style={{ height: SPACE.md }} />
            <SecondaryButton
              label="Dismiss"
              onPress={onDismiss}
              icon={<ScaledIcon name="close" size={16} color={COLORS.text} />}
            />
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 56,
    paddingHorizontal: SPACE.lg,
  },
  top: {
    alignItems: 'center',
    marginTop: SPACE.lg,
  },
  center: {
    alignItems: 'center',
  },
  ringBox: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.xl,
  },
  pulse: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  ringCore: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideChip: {
    marginTop: SPACE.md,
    paddingHorizontal: SPACE.lg,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  message: {
    marginTop: SPACE.lg,
    textAlign: 'center',
    paddingHorizontal: SPACE.md,
    lineHeight: 20,
  },
  actions: {
    width: '100%',
  },
});

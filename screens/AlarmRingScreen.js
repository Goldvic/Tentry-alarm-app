import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, Modal, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import ScaledText from '../components/ScaledText';
import ScaledIcon from '../components/ScaledIcon';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { useSettings } from '../context/SettingsContext';
import { COLORS } from '../lib/theme';

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

  const isBuy = (signal?.action || '').toUpperCase() === 'BUY';
  const isSell = (signal?.action || '').toUpperCase() === 'SELL';
  const sideColor = isBuy ? COLORS.buy : isSell ? COLORS.sell : accentTokens.from;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent presentationStyle="fullScreen">
      <StatusBar hidden />
      <LinearGradient colors={['#05070d', '#0c0f1c', '#05070d']} style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-between py-16 px-6">
          <View className="items-center mt-10">
            <ScaledText size={13} weight="700" color={COLORS.faint} style={{ letterSpacing: 3 }}>
              TENTRY SIGNAL
            </ScaledText>
            <ScaledText size={15} color={COLORS.dim} style={{ marginTop: 6 }}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </ScaledText>
          </View>

          <View className="items-center">
            <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
              <Animated.View
                style={{
                  position: 'absolute',
                  width: 160,
                  height: 160,
                  borderRadius: 80,
                  backgroundColor: sideColor,
                  opacity: ringOpacity,
                  transform: [{ scale: ringScale }],
                }}
              />
              <LinearGradient
                colors={[accentTokens.from, accentTokens.to]}
                style={{ width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' }}
              >
                <ScaledIcon name="alarm" size={52} color="#fff" />
              </LinearGradient>
            </View>

            {signal?.symbol ? (
              <ScaledText size={30} weight="800" color={COLORS.text} style={{ textAlign: 'center' }}>
                {signal.symbol}
              </ScaledText>
            ) : null}
            {signal?.action ? (
              <View
                style={{
                  marginTop: 10,
                  paddingHorizontal: 16,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: sideColor + '33',
                }}
              >
                <ScaledText size={16} weight="800" color={sideColor}>
                  {signal.action.toUpperCase()}
                </ScaledText>
              </View>
            ) : null}
            <ScaledText size={15} color={COLORS.dim} style={{ marginTop: 16, textAlign: 'center', paddingHorizontal: 20 }}>
              {signal?.message || 'Signal received from your Tentry bot'}
            </ScaledText>
          </View>

          <View style={{ width: '100%', gap: 12 }}>
            <PrimaryButton label={`Snooze ${snoozeMinutes} min`} onPress={onSnooze} icon={<ScaledIcon name="time" size={18} color="#fff" />} />
            <SecondaryButton label="Dismiss" onPress={onDismiss} icon={<ScaledIcon name="close" size={18} color={COLORS.text} />} />
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
}

import React from 'react';
import { TouchableOpacity, View, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import ScaledText from './ScaledText';
import { useSettings } from '../context/SettingsContext';
import { COLORS, RADIUS, SPACE } from '../lib/theme';

function tap(style = Haptics.ImpactFeedbackStyle.Light) {
  Haptics.impactAsync(style).catch(() => {});
}

export function PrimaryButton({ label, onPress, disabled, loading, icon, fullWidth = true }) {
  const { accentTokens } = useSettings();
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled || loading}
      onPress={() => {
        tap();
        onPress && onPress();
      }}
      style={{ opacity: disabled ? 0.4 : 1, alignSelf: fullWidth ? 'stretch' : 'flex-start' }}
    >
      <LinearGradient
        colors={[accentTokens.from, accentTokens.to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primary}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            {icon}
            <ScaledText size={13} weight="700" color="#fff" style={{ marginLeft: icon ? SPACE.sm : 0 }}>
              {label}
            </ScaledText>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, onPress, disabled, icon, fullWidth = true }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress && onPress();
      }}
      style={[
        styles.secondary,
        { opacity: disabled ? 0.4 : 1, alignSelf: fullWidth ? 'stretch' : 'flex-start' },
      ]}
    >
      {icon}
      <ScaledText size={13} weight="600" color={COLORS.text} style={{ marginLeft: icon ? SPACE.sm : 0 }}>
        {label}
      </ScaledText>
    </TouchableOpacity>
  );
}

export function Pill({ ok, label, tone }) {
  const bg = tone === 'warn' ? '#3b2e12' : ok ? '#123b2b' : '#3b1620';
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <ScaledText size={11} weight="600" color="#fff">
        {label}
      </ScaledText>
    </View>
  );
}

const styles = StyleSheet.create({
  primary: {
    paddingVertical: 11,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  secondary: {
    backgroundColor: COLORS.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingVertical: 10,
    paddingHorizontal: SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  pill: {
    paddingHorizontal: SPACE.md,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
});

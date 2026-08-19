import React from 'react';
import { TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import ScaledText from './ScaledText';
import { useSettings } from '../context/SettingsContext';

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
        style={{
          paddingVertical: 13,
          paddingHorizontal: 18,
          borderRadius: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            {icon}
            <ScaledText size={15} weight="700" color="#fff" style={{ marginLeft: icon ? 8 : 0 }}>
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
      className="bg-surface2 border border-border rounded-2xl py-3 px-4 flex-row items-center justify-center"
      style={{ opacity: disabled ? 0.4 : 1, alignSelf: fullWidth ? 'stretch' : 'flex-start' }}
    >
      {icon}
      <ScaledText size={15} weight="600" color="#f5f6fb" style={{ marginLeft: icon ? 8 : 0 }}>
        {label}
      </ScaledText>
    </TouchableOpacity>
  );
}

export function Pill({ ok, label, tone }) {
  const bg = tone === 'warn' ? '#3b2e12' : ok ? '#123b2b' : '#3b1620';
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' }}>
      <ScaledText size={12} weight="600" color="#fff">
        {label}
      </ScaledText>
    </View>
  );
}

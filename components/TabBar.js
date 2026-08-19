import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import ScaledText from './ScaledText';
import ScaledIcon from './ScaledIcon';
import { useSettings } from '../context/SettingsContext';
import { COLORS } from '../lib/theme';

const TABS = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'history', label: 'History', icon: 'time' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

export default function TabBar({ active, onChange }) {
  const insets = useSafeAreaInsets();
  const { accentTokens } = useSettings();

  return (
    <View
      style={{
        flexDirection: 'row',
        paddingBottom: Math.max(insets.bottom, 12),
        paddingTop: 10,
        paddingHorizontal: 14,
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
      }}
    >
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(tab.key);
            }}
            style={{ flex: 1, alignItems: 'center' }}
          >
            {isActive ? (
              <LinearGradient
                colors={[accentTokens.from, accentTokens.to]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  width: 44,
                  height: 30,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 3,
                }}
              >
                <ScaledIcon name={tab.icon} size={17} color="#fff" />
              </LinearGradient>
            ) : (
              <View style={{ width: 44, height: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 3 }}>
                <ScaledIcon name={tab.icon + '-outline'} size={19} color={COLORS.faint} />
              </View>
            )}
            <ScaledText size={11} weight={isActive ? '700' : '500'} color={isActive ? COLORS.text : COLORS.faint}>
              {tab.label}
            </ScaledText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

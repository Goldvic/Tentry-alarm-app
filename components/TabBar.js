import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import ScaledText from './ScaledText';
import ScaledIcon from './ScaledIcon';
import { COLORS, SPACE, LAYOUT } from '../lib/theme';

const TABS = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'signals', label: 'Signals', icon: 'flash' },
  { key: 'calculator', label: 'Calc', icon: 'calculator' },
  { key: 'history', label: 'Activity', icon: 'time' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

export default function TabBar({ active, onChange }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, SPACE.xs) },
      ]}
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
            style={styles.item}
          >
            <View style={styles.iconBox}>
              <ScaledIcon
                name={isActive ? tab.icon : tab.icon + '-outline'}
                size={isActive ? LAYOUT.tabIconActive : LAYOUT.tabIconInactive}
                color={isActive ? COLORS.iconActive : COLORS.iconInactive}
              />
            </View>
            <ScaledText
              size={9}
              weight={isActive ? '700' : '500'}
              color={isActive ? COLORS.iconActive : COLORS.labelInactive}
            >
              {tab.label}
            </ScaledText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: SPACE.xs,
    paddingHorizontal: SPACE.xs,
    backgroundColor: COLORS.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACE.xs,
  },
  iconBox: {
    width: 32,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});

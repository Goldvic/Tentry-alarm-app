import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScaledText from './ScaledText';
import ScaledIcon from './ScaledIcon';
import { COLORS, SPACE, LAYOUT } from '../lib/theme';

export default function AppHeader({ title, subtitle, right, onRightPress }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: Math.max(insets.top, SPACE.sm), backgroundColor: COLORS.bg }}>
      <View style={styles.rule} />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <View style={styles.dot} />
            <ScaledText size={14} weight="800" color={COLORS.white} style={{ letterSpacing: 0.4 }}>
              {title}
            </ScaledText>
          </View>
          {subtitle ? (
            <ScaledText size={10} color={COLORS.faint} style={styles.sub}>
              {subtitle}
            </ScaledText>
          ) : null}
        </View>
        {right ? (
          <TouchableOpacity onPress={onRightPress} hitSlop={8} style={{ padding: SPACE.xs }}>
            {typeof right === 'string' ? (
              <ScaledIcon name={right} size={17} color={COLORS.dim} />
            ) : (
              right
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rule: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: LAYOUT.screenPadH + 2,
    backgroundColor: COLORS.edge,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.screenPadH + 2,
    paddingVertical: LAYOUT.headerPadV,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginRight: SPACE.sm,
    backgroundColor: COLORS.dim,
  },
  sub: {
    marginTop: 2,
    marginLeft: 13,
  },
});

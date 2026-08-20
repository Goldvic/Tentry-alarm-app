import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACE, LAYOUT } from '../lib/theme';

export default function Card({ children, style, noPad, noMargin }) {
  return (
    <View
      style={[
        styles.card,
        noPad && { padding: 0 },
        noMargin && { marginBottom: 0 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: LAYOUT.cardPad,
    marginBottom: LAYOUT.cardGap,
  },
});

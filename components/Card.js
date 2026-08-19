import React from 'react';
import { View } from 'react-native';

// A "glass" card: dark surface, faint border, subtle top highlight via a
// 1px lighter border-top color — cheap to render (no blur view needed)
// but reads as glassmorphic against the near-black background.
export default function Card({ children, className = '', style }) {
  return (
    <View
      className={`bg-surface rounded-2xl border border-border p-4 mb-4 ${className}`}
      style={[{ borderTopColor: '#3a4270' }, style]}
    >
      {children}
    </View>
  );
}

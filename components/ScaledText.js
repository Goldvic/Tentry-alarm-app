import React from 'react';
import { Text } from 'react-native';
import { useSettings } from '../context/SettingsContext';

// size = base pt size at "Medium" display scale. Every screen should use
// this instead of a raw <Text> for anything user-facing so the app-wide
// Display size setting (Settings > Appearance) actually reaches every
// label, not just a couple of hardcoded ones.
export default function ScaledText({ size = 14, weight, color, style, className = '', children, ...rest }) {
  const { scale } = useSettings();
  return (
    <Text
      className={className}
      style={[
        {
          fontSize: scale(size),
          fontWeight: weight,
          color,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

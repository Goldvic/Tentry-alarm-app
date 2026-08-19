import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';

// size = base icon size at "Medium" display scale. Every icon in the app
// (tab bar, buttons, status rows) should route through this so "all icon
// sizes need to be adjustable" applies globally from one setting instead
// of per-screen tweaks.
export default function ScaledIcon({ name, size = 20, color = '#f5f6fb', style }) {
  const { scale } = useSettings();
  return <Ionicons name={name} size={scale(size)} color={color} style={style} />;
}

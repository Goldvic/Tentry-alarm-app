import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import AppHeader from '../components/AppHeader';
import ScaledText from '../components/ScaledText';
import HistoryScreen from './HistoryScreen';
import CalendarScreen from './CalendarScreen';
import NotificationsScreen from './NotificationsScreen';
import { COLORS, SPACE, RADIUS, LAYOUT } from '../lib/theme';

const SEGMENTS = [
  { key: 'history', label: 'History' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'notifications', label: 'Notifs' },
];

export default function ActivityScreen({ alarmHistory, notificationLog, onClearHistory }) {
  const [seg, setSeg] = useState('history');

  return (
    <View style={styles.root}>
      <AppHeader title="Activity" subtitle="History · Calendar · Notifications" />
      <View style={styles.segment}>
        {SEGMENTS.map((s) => {
          const active = seg === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              onPress={() => setSeg(s.key)}
              style={[styles.segItem, active && styles.segActive]}
            >
              <ScaledText size={11} weight="700" color={active ? COLORS.white : COLORS.faint}>
                {s.label}
              </ScaledText>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ flex: 1 }}>
        {seg === 'history' && (
          <HistoryScreen alarmHistory={alarmHistory} onClearHistory={onClearHistory} embedded />
        )}
        {seg === 'calendar' && <CalendarScreen alarmHistory={alarmHistory} embedded />}
        {seg === 'notifications' && <NotificationsScreen notificationLog={notificationLog} embedded />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  segment: {
    flexDirection: 'row',
    marginHorizontal: LAYOUT.screenPadH,
    marginBottom: SPACE.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  segItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  segActive: {
    backgroundColor: COLORS.surface2,
  },
});

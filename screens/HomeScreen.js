import React from 'react';
import { View, ScrollView, Platform, TouchableOpacity, StyleSheet } from 'react-native';
import Card from '../components/Card';
import AppHeader from '../components/AppHeader';
import AnalogClock from '../components/AnalogClock';
import ScaledText from '../components/ScaledText';
import ScaledIcon from '../components/ScaledIcon';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { COLORS, SPACE, RADIUS, LAYOUT } from '../lib/theme';
import {
  openBatteryOptimizationSettings,
  openFullScreenIntentSettings,
  openOverlaySettings,
  openDndAccessSettings,
} from '../lib/notifications';

export default function HomeScreen({
  results,
  pushToken,
  notifGranted,
  alarmName,
  onPickSong,
  onTestAlarm,
  onStopAlarm,
  isAlarmPlaying,
  lastSignal,
  recentSignals = [],
  alarmsToday = 0,
  onFixNotifications,
  onFixStep,
}) {
  const isAndroid = Platform.OS === 'android';

  const issues = [];
  if (!notifGranted) issues.push({ key: 'notif', label: 'Notifications off', fix: onFixNotifications });
  if (isAndroid && !results.dnd)
    issues.push({ key: 'dnd', label: 'DND bypass off', fix: () => { openDndAccessSettings(); onFixStep?.('dnd'); } });
  if (isAndroid && !results.overlay)
    issues.push({ key: 'overlay', label: 'Overlay off', fix: () => { openOverlaySettings(); onFixStep?.('overlay'); } });
  if (isAndroid && !results.battery)
    issues.push({ key: 'battery', label: 'Battery opt. on', fix: () => { openBatteryOptimizationSettings(); onFixStep?.('battery'); } });
  if (isAndroid && !results.fullscreen)
    issues.push({ key: 'fullscreen', label: 'Full-screen off', fix: () => { openFullScreenIntentSettings(); onFixStep?.('fullscreen'); } });

  return (
    <View style={styles.root}>
      <AppHeader title="Tentry" subtitle="Live alarm desk" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <AnalogClock size={148} />

        {issues.length > 0 && (
          <View style={styles.issueBox}>
            {issues.map((p, idx) => (
              <View
                key={p.key}
                style={[styles.issueRow, idx === issues.length - 1 && { marginBottom: 0 }]}
              >
                <ScaledIcon name="warning" size={12} color={COLORS.warn} style={{ marginRight: SPACE.sm }} />
                <ScaledText size={11} color={COLORS.dim} style={{ flex: 1 }}>{p.label}</ScaledText>
                <TouchableOpacity onPress={p.fix} style={styles.fixBtn} hitSlop={6}>
                  <ScaledText size={10} weight="700" color={COLORS.warn}>Fix</ScaledText>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <ScaledText size={9} color={COLORS.faint}>Today</ScaledText>
            <ScaledText size={18} weight="800" color={COLORS.white}>{alarmsToday}</ScaledText>
          </View>
          <View style={styles.stat}>
            <ScaledText size={9} color={COLORS.faint}>Token</ScaledText>
            <ScaledText size={12} weight="700" color={pushToken ? COLORS.dim : COLORS.warn}>
              {pushToken ? 'Ready' : 'None'}
            </ScaledText>
          </View>
          <View style={styles.stat}>
            <ScaledText size={9} color={COLORS.faint}>Sound</ScaledText>
            <ScaledText size={11} weight="600" color={COLORS.text} numberOfLines={1}>
              {alarmName ? 'Custom' : 'Default'}
            </ScaledText>
          </View>
        </View>

        {lastSignal ? (
          <Card style={{ marginTop: SPACE.sm }}>
            <View style={styles.latestHead}>
              <View style={styles.dot} />
              <ScaledText size={10} weight="700" color={COLORS.faint}>LATEST</ScaledText>
            </View>
            <ScaledText size={12} color={COLORS.dim} numberOfLines={2}>
              {typeof lastSignal === 'string' ? lastSignal : lastSignal.message || ''}
            </ScaledText>
          </Card>
        ) : null}

        <Card style={{ marginTop: lastSignal ? 0 : SPACE.sm }}>
          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <SecondaryButton label={alarmName ? 'Tone' : 'Pick tone'} onPress={onPickSong} />
            </View>
            <View style={{ width: SPACE.sm }} />
            <View style={{ flex: 1 }}>
              {!isAlarmPlaying ? (
                <SecondaryButton
                  label="Test"
                  onPress={onTestAlarm}
                  icon={<ScaledIcon name="play" size={13} color={COLORS.text} />}
                />
              ) : (
                <PrimaryButton
                  label="Stop"
                  onPress={onStopAlarm}
                  icon={<ScaledIcon name="stop" size={13} color="#fff" />}
                />
              )}
            </View>
          </View>
        </Card>

        {recentSignals.length > 0 && (
          <Card>
            {recentSignals.slice(0, 5).map((s, i) => {
              const msg = s.message || s.body || '';
              const isBuy = /buy|long/i.test(msg);
              const isSell = /sell|short/i.test(msg);
              return (
                <View
                  key={i}
                  style={[
                    styles.recentRow,
                    i > 0 && styles.recentBorder,
                  ]}
                >
                  <View
                    style={[
                      styles.sideDot,
                      { backgroundColor: isBuy ? COLORS.buy : isSell ? COLORS.sell : COLORS.faint },
                    ]}
                  />
                  <ScaledText size={11} color={COLORS.text} style={{ flex: 1 }} numberOfLines={1}>
                    {msg}
                  </ScaledText>
                  <ScaledText size={9} color={COLORS.faint}>{s.time || ''}</ScaledText>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: {
    paddingHorizontal: LAYOUT.screenPadH,
    paddingBottom: LAYOUT.screenPadBottom,
  },
  issueBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3d3218',
    padding: SPACE.sm,
    marginBottom: SPACE.sm,
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACE.xs,
    minHeight: 28,
  },
  fixBtn: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.warn + '22',
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACE.sm,
    marginBottom: SPACE.sm,
  },
  stat: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    paddingVertical: SPACE.sm + 2,
    alignItems: 'center',
  },
  latestHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACE.xs,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.dim,
    marginRight: SPACE.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
  },
  recentBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  sideDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginRight: SPACE.sm,
  },
});

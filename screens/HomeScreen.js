import React from 'react';
import { View, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Card from '../components/Card';
import ScaledText from '../components/ScaledText';
import ScaledIcon from '../components/ScaledIcon';
import { PrimaryButton, SecondaryButton, Pill } from '../components/Buttons';
import { SectionTitle, StatusRow } from '../components/Rows';
import { useSettings } from '../context/SettingsContext';
import { COLORS } from '../lib/theme';

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
  relayUrl,
  onFixNotifications,
  onFixStep,
  onGoSettings,
}) {
  const { accentTokens } = useSettings();
  const isAndroid = Platform.OS === 'android';
  const androidOk = !isAndroid || (results.dnd && results.overlay && results.battery && results.fullscreen);
  const allGood = notifGranted && androidOk && pushToken;

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 20, paddingTop: 64, paddingBottom: 40 }}>
      <View className="flex-row items-center justify-between mb-6">
        <View>
          <ScaledText size={13} color={COLORS.faint} weight="600" style={{ letterSpacing: 2 }}>
            TENTRY
          </ScaledText>
          <ScaledText size={26} weight="800" color={COLORS.text}>
            Alarm Dashboard
          </ScaledText>
        </View>
        <LinearGradient
          colors={[accentTokens.from, accentTokens.to]}
          style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
        >
          <ScaledIcon name="pulse" size={22} color="#fff" />
        </LinearGradient>
      </View>

      <Card>
        <View className="flex-row justify-between items-center mb-1">
          <SectionTitle icon="shield-checkmark">Status</SectionTitle>
          <Pill ok={allGood} label={allGood ? 'All set' : 'Needs attention'} />
        </View>
        <StatusRow label="Notifications" ok={notifGranted} onFix={onFixNotifications} />
        {isAndroid && <StatusRow label="Do Not Disturb bypass" ok={!!results.dnd} onFix={() => onFixStep('dnd')} />}
        {isAndroid && <StatusRow label="Display over other apps" ok={!!results.overlay} onFix={() => onFixStep('overlay')} />}
        {isAndroid && <StatusRow label="Battery optimization exempt" ok={!!results.battery} onFix={() => onFixStep('battery')} />}
        {isAndroid && (
          <StatusRow label="Full-screen alarm (Android 14+)" ok={!!results.fullscreen} onFix={() => onFixStep('fullscreen')} />
        )}
        <StatusRow label="Device registered" ok={!!pushToken} onFix={() => onFixStep('pushtoken')} />
        <ScaledText size={12} color={COLORS.faint} style={{ marginTop: 10, lineHeight: 16 }}>
          Android can't report these back live — they reflect what you confirmed during setup. Tap "Fix" if
          signals ever stop ringing.
        </ScaledText>
      </Card>

      <Card>
        <SectionTitle icon="musical-notes">Alarm Sound</SectionTitle>
        <ScaledText size={14} color={COLORS.dim}>
          {alarmName ? `Currently using: ${alarmName}` : 'Using the built-in siren tone.'}
        </ScaledText>
        <View className="flex-row flex-wrap mt-3" style={{ gap: 10 }}>
          <View style={{ flex: 1 }}>
            <SecondaryButton label={alarmName ? 'Change Song' : 'Choose Song'} onPress={onPickSong} />
          </View>
          <View style={{ flex: 1 }}>
            {!isAlarmPlaying ? (
              <SecondaryButton label="Test Alarm" onPress={onTestAlarm} icon={<ScaledIcon name="play" size={16} color={COLORS.text} />} />
            ) : (
              <PrimaryButton label="Stop" onPress={onStopAlarm} icon={<ScaledIcon name="stop" size={16} color="#fff" />} />
            )}
          </View>
        </View>
      </Card>

      {lastSignal && (
        <Card>
          <SectionTitle icon="flash">Last Signal</SectionTitle>
          <ScaledText size={14} color={COLORS.dim}>
            {lastSignal}
          </ScaledText>
        </Card>
      )}

      {!relayUrl && (
        <Card style={{ borderColor: '#4a3a12' }}>
          <SectionTitle icon="link">Relay Not Connected</SectionTitle>
          <ScaledText size={14} color={COLORS.dim} style={{ marginBottom: 12 }}>
            Connect your relay server so your Tentry bot can actually reach this phone.
          </ScaledText>
          <SecondaryButton label="Go to Settings" onPress={onGoSettings} icon={<ScaledIcon name="arrow-forward" size={16} color={COLORS.text} />} />
        </Card>
      )}
    </ScrollView>
  );
}

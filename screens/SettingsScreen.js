import React, { useState } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import * as Clipboard from 'expo-clipboard';
import Card from '../components/Card';
import ScaledText from '../components/ScaledText';
import ScaledIcon from '../components/ScaledIcon';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { SectionTitle, StatusRow, SwitchRow, ChoiceRow } from '../components/Rows';
import { useSettings } from '../context/SettingsContext';
import { ACCENTS, SCALE_LABELS, VIBRATION_PATTERNS, SNOOZE_OPTIONS, AUTO_DISMISS_OPTIONS } from '../lib/theme';
import { COLORS } from '../lib/theme';

const SCALE_OPTIONS = Object.keys(SCALE_LABELS).map((key) => ({ key, label: SCALE_LABELS[key] }));
const SNOOZE_CHOICES = SNOOZE_OPTIONS.map((m) => ({ key: String(m), label: `${m} min` }));
const DISMISS_CHOICES = AUTO_DISMISS_OPTIONS.map((m) => ({ key: String(m), label: m === 0 ? 'Never' : `${m} min` }));
const VIBE_CHOICES = Object.keys(VIBRATION_PATTERNS).map((key) => ({ key, label: VIBRATION_PATTERNS[key].label }));

function inputStyle() {
  return {
    backgroundColor: '#0a0d18',
    color: COLORS.text,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  };
}

export default function SettingsScreen({
  results,
  notifGranted,
  onFixNotifications,
  onFixStep,
  onRerunSetup,
  pushToken,
  relayUrl,
  setRelayUrl,
  webhookSecret,
  setWebhookSecret,
  onSaveRelay,
  onRegisterToken,
  onSendTestSignal,
  registering,
  sendingTest,
}) {
  const {
    uiScale,
    setUiScale,
    accent,
    setAccent,
    accentTokens,
    forceMaxVolume,
    setForceMaxVolume,
    alarmVolume,
    setAlarmVolume,
    snoozeMinutes,
    setSnoozeMinutes,
    autoDismissMinutes,
    setAutoDismissMinutes,
    vibrationPattern,
    setVibrationPattern,
    keepAwake,
    setKeepAwake,
  } = useSettings();

  const [copied, setCopied] = useState(false);
  const copyToken = async () => {
    if (!pushToken) return;
    await Clipboard.setStringAsync(pushToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 20, paddingTop: 64, paddingBottom: 60 }}>
      <ScaledText size={26} weight="800" color={COLORS.text} style={{ marginBottom: 20 }}>
        Settings
      </ScaledText>

      {/* Appearance */}
      <Card>
        <SectionTitle icon="color-palette">Appearance</SectionTitle>
        <ScaledText size={13} color={COLORS.faint} style={{ marginTop: 4 }}>
          Display size — scales all text and icons app-wide
        </ScaledText>
        <ChoiceRow options={SCALE_OPTIONS} value={uiScale} onChange={setUiScale} />

        <ScaledText size={13} color={COLORS.faint} style={{ marginTop: 10 }}>
          Accent color
        </ScaledText>
        <View className="flex-row flex-wrap" style={{ marginTop: 8 }}>
          {Object.keys(ACCENTS).map((key) => {
            const a = ACCENTS[key];
            const active = key === accent;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setAccent(key)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  marginRight: 12,
                  marginBottom: 8,
                  backgroundColor: a.from,
                  borderWidth: active ? 3 : 0,
                  borderColor: '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {active && <ScaledIcon name="checkmark" size={16} color="#fff" />}
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      {/* Alarm behavior */}
      <Card>
        <SectionTitle icon="alarm">Alarm Behavior</SectionTitle>
        <SwitchRow
          label="Force alarm to full volume"
          sub="Overrides the alarm volume stream to max every time it rings — even if the phone is on silent/vibrate."
          value={forceMaxVolume}
          onValueChange={setForceMaxVolume}
        />
        {!forceMaxVolume && (
          <View style={{ marginBottom: 12 }}>
            <ScaledText size={13} color={COLORS.faint} style={{ marginBottom: 4 }}>
              Alarm volume — {Math.round(alarmVolume * 100)}%
            </ScaledText>
            <Slider
              minimumValue={0.1}
              maximumValue={1}
              value={alarmVolume}
              onSlidingComplete={setAlarmVolume}
              minimumTrackTintColor={accentTokens.from}
              maximumTrackTintColor={COLORS.border}
              thumbTintColor={accentTokens.from}
            />
          </View>
        )}

        <ScaledText size={13} color={COLORS.faint} style={{ marginTop: 4 }}>
          Snooze duration
        </ScaledText>
        <ChoiceRow options={SNOOZE_CHOICES} value={String(snoozeMinutes)} onChange={(v) => setSnoozeMinutes(Number(v))} />

        <ScaledText size={13} color={COLORS.faint} style={{ marginTop: 6 }}>
          Auto-dismiss after
        </ScaledText>
        <ChoiceRow options={DISMISS_CHOICES} value={String(autoDismissMinutes)} onChange={(v) => setAutoDismissMinutes(Number(v))} />

        <ScaledText size={13} color={COLORS.faint} style={{ marginTop: 6 }}>
          Vibration pattern
        </ScaledText>
        <ChoiceRow options={VIBE_CHOICES} value={vibrationPattern} onChange={setVibrationPattern} />

        <View style={{ marginTop: 10 }}>
          <SwitchRow label="Keep screen awake while app is open" value={keepAwake} onValueChange={setKeepAwake} />
        </View>
      </Card>

      {/* Permissions */}
      <Card>
        <SectionTitle icon="shield-checkmark">Permissions</SectionTitle>
        <StatusRow label="Notifications" ok={notifGranted} onFix={onFixNotifications} />
        {Platform.OS === 'android' && (
          <>
            <StatusRow label="Do Not Disturb bypass" ok={!!results.dnd} onFix={() => onFixStep('dnd')} />
            <StatusRow label="Display over other apps" ok={!!results.overlay} onFix={() => onFixStep('overlay')} />
            <StatusRow label="Battery optimization exempt" ok={!!results.battery} onFix={() => onFixStep('battery')} />
            <StatusRow label="Full-screen alarm (Android 14+)" ok={!!results.fullscreen} onFix={() => onFixStep('fullscreen')} />
          </>
        )}
        <StatusRow label="Device registered" ok={!!pushToken} onFix={() => onFixStep('pushtoken')} />
        <View style={{ marginTop: 14 }}>
          <SecondaryButton label="Re-run Full Setup" onPress={onRerunSetup} icon={<ScaledIcon name="refresh" size={16} color={COLORS.text} />} />
        </View>
      </Card>

      {/* Relay connection */}
      <Card>
        <SectionTitle icon="link">Relay Connection</SectionTitle>
        <ScaledText size={13} color={COLORS.dim}>
          Your push token — the relay server uses this to target this exact phone.
        </ScaledText>
        <ScaledText
          size={11}
          color={COLORS.buy}
          selectable
          style={{ marginTop: 8, fontFamily: 'monospace', backgroundColor: '#0a0d18', padding: 10, borderRadius: 8 }}
        >
          {pushToken || 'Not generated yet'}
        </ScaledText>
        <View style={{ marginTop: 10, marginBottom: 16, alignItems: 'flex-start' }}>
          <SecondaryButton label={copied ? 'Copied ✓' : 'Copy Token'} onPress={copyToken} disabled={!pushToken} fullWidth={false} />
        </View>

        <ScaledText size={12} color={COLORS.faint} style={{ marginBottom: 4 }}>
          Relay Server URL
        </ScaledText>
        <TextInput
          style={inputStyle()}
          placeholder="https://your-relay.onrender.com"
          placeholderTextColor={COLORS.faint}
          autoCapitalize="none"
          autoCorrect={false}
          value={relayUrl}
          onChangeText={setRelayUrl}
        />

        <ScaledText size={12} color={COLORS.faint} style={{ marginTop: 12, marginBottom: 4 }}>
          Webhook Secret
        </ScaledText>
        <TextInput
          style={inputStyle()}
          placeholder="change-me"
          placeholderTextColor={COLORS.faint}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          value={webhookSecret}
          onChangeText={setWebhookSecret}
        />

        <View style={{ marginTop: 16, gap: 10 }}>
          <SecondaryButton label="Save" onPress={onSaveRelay} />
          <SecondaryButton
            label={registering ? 'Registering…' : 'Register Device'}
            onPress={onRegisterToken}
            disabled={registering || !relayUrl || !pushToken}
          />
          <PrimaryButton label={sendingTest ? 'Sending…' : 'Send Test Signal'} onPress={onSendTestSignal} loading={sendingTest} disabled={!relayUrl} />
        </View>
        <ScaledText size={12} color={COLORS.faint} style={{ marginTop: 10, lineHeight: 16 }}>
          "Register Device" saves your token on the relay automatically. "Send Test Signal" fires a fake BUY
          signal through the relay to your phone, end to end.
        </ScaledText>
      </Card>

      <Card>
        <SectionTitle icon="information-circle">About</SectionTitle>
        <ScaledText size={13} color={COLORS.faint}>
          Tentry Alarm v4.0.0
        </ScaledText>
      </Card>
    </ScrollView>
  );
}

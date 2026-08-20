import React, { useEffect, useState } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, Platform, Alert, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import * as Clipboard from 'expo-clipboard';
import Card from '../components/Card';
import AppHeader from '../components/AppHeader';
import ScaledText from '../components/ScaledText';
import ScaledIcon from '../components/ScaledIcon';
import { SecondaryButton } from '../components/Buttons';
import { StatusRow, SwitchRow, ChoiceRow } from '../components/Rows';
import { useSettings } from '../context/SettingsContext';
import {
  ACCENTS, SCALE_LABELS, VIBRATION_PATTERNS, SNOOZE_OPTIONS, AUTO_DISMISS_OPTIONS, COLORS,
} from '../lib/theme';
import {
  openBatteryOptimizationSettings, openFullScreenIntentSettings, openOverlaySettings, openDndAccessSettings,
} from '../lib/notifications';
import { getBridgeConfig, setBridgeConfig } from '../lib/signalBridge';

const SCALE_OPTIONS = Object.keys(SCALE_LABELS).map((key) => ({ key, label: SCALE_LABELS[key] }));
const SNOOZE_CHOICES = SNOOZE_OPTIONS.map((m) => ({ key: String(m), label: `${m}m` }));
const DISMISS_CHOICES = AUTO_DISMISS_OPTIONS.map((m) => ({ key: String(m), label: m === 0 ? 'Off' : `${m}m` }));
const VIBE_CHOICES = Object.keys(VIBRATION_PATTERNS).map((key) => ({ key, label: VIBRATION_PATTERNS[key].label }));
const CLOCK_CHOICES = [{ key: '12h', label: '12h' }, { key: '24h', label: '24h' }];

function inputStyle() {
  return {
    backgroundColor: '#0a0d18',
    color: COLORS.text,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  };
}

function Accordion({ title, icon, open, onToggle, children }) {
  return (
    <Card style={{ padding: 0, marginBottom: 8, overflow: 'hidden' }}>
      <TouchableOpacity
        onPress={onToggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 12,
          minHeight: 48,
          backgroundColor: open ? COLORS.surface2 : 'transparent',
        }}
      >
        <ScaledIcon name={icon} size={16} color={open ? COLORS.white : COLORS.dim} style={{ marginRight: 8 }} />
        <ScaledText size={13} weight="700" color={COLORS.text} style={{ flex: 1 }}>{title}</ScaledText>
        <ScaledIcon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.faint} />
      </TouchableOpacity>
      {open ? <View style={{ paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 }}>{children}</View> : null}
    </Card>
  );
}

export default function SettingsScreen({
  results, notifGranted, onFixNotifications, onFixStep, onRerunSetup,
  pushToken, onTestAlarm, onPickSong, alarmName,
}) {
  const s = useSettings();
  const [openKey, setOpenKey] = useState('alarm');
  const [copied, setCopied] = useState(false);
  const [bridgeMode, setBridgeMode] = useState('off');
  const [ntfyTopic, setNtfyTopic] = useState('');
  const [ntfyServer, setNtfyServer] = useState('https://ntfy.sh');
  const [pollUrl, setPollUrl] = useState('');
  const [pollApiKey, setPollApiKey] = useState('');
  const [bridgeSaved, setBridgeSaved] = useState(false);

  useEffect(() => {
    getBridgeConfig().then((c) => {
      setBridgeMode(c.mode || 'off');
      setNtfyTopic(c.ntfyTopic || '');
      setNtfyServer(c.ntfyServer || 'https://ntfy.sh');
      setPollUrl(c.pollUrl || '');
      setPollApiKey(c.pollApiKey || '');
    }).catch(() => {});
  }, []);

  const saveBridge = async () => {
    await setBridgeConfig({
      mode: bridgeMode,
      ntfyTopic: ntfyTopic.trim(),
      ntfyServer: ntfyServer.trim() || 'https://ntfy.sh',
      pollUrl: pollUrl.trim(),
      pollApiKey: pollApiKey.trim(),
      pollIntervalMs: 10000,
    });
    setBridgeSaved(true);
    setTimeout(() => setBridgeSaved(false), 2000);
  };

  const toggle = (k) => setOpenKey((prev) => (prev === k ? null : k));

  const copyToken = async () => {
    if (!pushToken) return;
    await Clipboard.setStringAsync(pushToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <AppHeader title="Settings" subtitle="Tap a section to expand" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        <Accordion title="Alarm" icon="alarm" open={openKey === 'alarm'} onToggle={() => toggle('alarm')}>
          <ScaledText size={11} color={COLORS.dim} style={{ marginBottom: 6 }}>
            {alarmName ? `Sound: ${alarmName}` : 'Built-in siren'}
          </ScaledText>
          <View style={{ marginBottom: 8 }}>
            <SecondaryButton label={alarmName ? 'Change sound' : 'Pick sound'} onPress={onPickSong} />
          </View>
          <View style={{ marginBottom: 8 }}>
            <SecondaryButton label="Test Alarm" onPress={onTestAlarm} icon={<ScaledIcon name="play" size={14} color={COLORS.text} />} />
          </View>
          <SwitchRow
            label="Force Max Volume"
            sub="Max alarm stream on every ring"
            value={s.forceMaxVolume}
            onValueChange={s.setForceMaxVolume}
          />
          {!s.forceMaxVolume && (
            <View style={{ marginBottom: 8 }}>
              <ScaledText size={11} color={COLORS.faint}>Volume {Math.round(s.alarmVolume * 100)}%</ScaledText>
              <Slider
                minimumValue={0.1} maximumValue={1} value={s.alarmVolume}
                onSlidingComplete={s.setAlarmVolume}
                minimumTrackTintColor={s.accentTokens.from}
                maximumTrackTintColor={COLORS.border}
                thumbTintColor={s.accentTokens.from}
              />
            </View>
          )}
          <ScaledText size={11} color={COLORS.faint}>Snooze</ScaledText>
          <ChoiceRow options={SNOOZE_CHOICES} value={String(s.snoozeMinutes)} onChange={(v) => s.setSnoozeMinutes(Number(v))} />
          <ScaledText size={11} color={COLORS.faint}>Auto-dismiss</ScaledText>
          <ChoiceRow options={DISMISS_CHOICES} value={String(s.autoDismissMinutes)} onChange={(v) => s.setAutoDismissMinutes(Number(v))} />
          <ScaledText size={11} color={COLORS.faint}>Vibration</ScaledText>
          <ChoiceRow options={VIBE_CHOICES} value={s.vibrationPattern} onChange={s.setVibrationPattern} />
          <SwitchRow label="Keep screen on" value={s.keepAwake} onValueChange={s.setKeepAwake} />
        </Accordion>

        <Accordion title="Notifications" icon="notifications" open={openKey === 'notifications'} onToggle={() => toggle('notifications')}>
          <ScaledText size={11} color={COLORS.faint} style={{ marginBottom: 4 }}>Quiet hours start (HH:mm)</ScaledText>
          <TextInput style={inputStyle()} value={s.quietHoursStart} onChangeText={s.setQuietHoursStart} placeholder="22:00" placeholderTextColor={COLORS.faint} />
          <ScaledText size={11} color={COLORS.faint} style={{ marginTop: 8, marginBottom: 4 }}>Quiet hours end</ScaledText>
          <TextInput style={inputStyle()} value={s.quietHoursEnd} onChangeText={s.setQuietHoursEnd} placeholder="07:00" placeholderTextColor={COLORS.faint} />
          <View style={{ marginTop: 10 }}>
            <SwitchRow label="Vibration on notifications" value={s.notifVibration} onValueChange={s.setNotifVibration} />
          </View>
        </Accordion>

        <Accordion title="Appearance" icon="color-palette" open={openKey === 'appearance'} onToggle={() => toggle('appearance')}>
          <ScaledText size={11} color={COLORS.faint}>Display size</ScaledText>
          <ChoiceRow options={SCALE_OPTIONS} value={s.uiScale} onChange={s.setUiScale} />
          <ScaledText size={11} color={COLORS.faint} style={{ marginTop: 6 }}>Accent</ScaledText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
            {Object.keys(ACCENTS).map((key) => {
              const a = ACCENTS[key];
              const active = key === s.accent;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => s.setAccent(key)}
                  style={{
                    width: 32, height: 32, borderRadius: 16, marginRight: 10, marginBottom: 6,
                    backgroundColor: a.from, borderWidth: active ? 2 : 0, borderColor: '#fff',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {active && <ScaledIcon name="checkmark" size={12} color="#fff" />}
                </TouchableOpacity>
              );
            })}
          </View>
          <ScaledText size={11} color={COLORS.faint} style={{ marginTop: 4 }}>Clock</ScaledText>
          <ChoiceRow options={CLOCK_CHOICES} value={s.clockFormat} onChange={s.setClockFormat} />
        </Accordion>

        <Accordion title="Permissions & status" icon="shield-checkmark" open={openKey === 'permissions'} onToggle={() => toggle('permissions')}>
          <StatusRow label="Notifications" ok={notifGranted} onFix={onFixNotifications} />
          {Platform.OS === 'android' && (
            <>
              <StatusRow label="DND bypass" ok={!!results.dnd} onFix={() => { openDndAccessSettings(); onFixStep?.('dnd'); }} />
              <StatusRow label="Display over apps" ok={!!results.overlay} onFix={() => { openOverlaySettings(); onFixStep?.('overlay'); }} />
              <StatusRow label="Battery opt. exempt" ok={!!results.battery} onFix={() => { openBatteryOptimizationSettings(); onFixStep?.('battery'); }} />
              <StatusRow label="Full-screen intent" ok={!!results.fullscreen} onFix={() => { openFullScreenIntentSettings(); onFixStep?.('fullscreen'); }} />
            </>
          )}
          <StatusRow label="Push token" ok={!!pushToken} onFix={() => onFixStep?.('pushtoken')} />
          <View style={{ marginTop: 10 }}>
            <SecondaryButton label="Re-run setup" onPress={onRerunSetup} icon={<ScaledIcon name="refresh" size={14} color={COLORS.text} />} />
          </View>
        </Accordion>

        <Accordion title="Account" icon="person" open={openKey === 'account'} onToggle={() => toggle('account')}>
          <ScaledText size={11} color={COLORS.dim} style={{ marginBottom: 6 }}>
            Local email label only — settings stay on this device (no cloud DB).
          </ScaledText>
          <TextInput
            style={[inputStyle(), { marginBottom: 8 }]}
            placeholder="you@gmail.com"
            placeholderTextColor={COLORS.faint}
            autoCapitalize="none"
            keyboardType="email-address"
            value={s.googleEmail || ''}
            onChangeText={(t) => s.setGoogleEmail(t.trim().toLowerCase() || null)}
          />
          {s.googleEmail ? (
            <SecondaryButton label="Clear email" onPress={() => s.setGoogleEmail(null)} />
          ) : null}
          <ScaledText size={11} color={COLORS.faint} style={{ marginTop: 12, marginBottom: 4 }}>
            Expo push token (paste into Entry Bot):
          </ScaledText>
          <ScaledText
            size={10}
            color={COLORS.buy}
            selectable
            style={{ fontFamily: 'monospace', backgroundColor: '#0a0d18', padding: 8, borderRadius: 8 }}
          >
            {pushToken || 'Not generated yet'}
          </ScaledText>
          <View style={{ marginTop: 8, alignItems: 'flex-start' }}>
            <SecondaryButton label={copied ? 'Copied' : 'Copy token'} onPress={copyToken} disabled={!pushToken} fullWidth={false} />
          </View>
        </Accordion>

        <Accordion title="Signal bridge (recommended)" icon="git-network" open={openKey === 'bridge'} onToggle={() => toggle('bridge')}>
          <ScaledText size={11} color={COLORS.dim} style={{ marginBottom: 8 }}>
            Expo Push is often blocked on ColorOS / MIUI even with a foreground service.
            Use ntfy (easiest) or HTTP poll — both run while Monitoring is active and ring the alarm without Expo.
          </ScaledText>
          <ScaledText size={11} color={COLORS.faint} style={{ marginBottom: 4 }}>Mode</ScaledText>
          <ChoiceRow
            options={[
              { key: 'off', label: 'Off' },
              { key: 'ntfy', label: 'ntfy' },
              { key: 'poll', label: 'HTTP poll' },
            ]}
            value={bridgeMode}
            onChange={setBridgeMode}
          />
          {bridgeMode === 'ntfy' ? (
            <View style={{ marginTop: 10 }}>
              <ScaledText size={11} color={COLORS.faint} style={{ marginBottom: 4 }}>
                Topic (pick a secret name, e.g. tentry-yourname-8291)
              </ScaledText>
              <TextInput
                style={[inputStyle(), { marginBottom: 8 }]}
                placeholder="tentry-mytopic"
                placeholderTextColor={COLORS.faint}
                autoCapitalize="none"
                autoCorrect={false}
                value={ntfyTopic}
                onChangeText={setNtfyTopic}
              />
              <ScaledText size={11} color={COLORS.faint} style={{ marginBottom: 4 }}>Server</ScaledText>
              <TextInput
                style={[inputStyle(), { marginBottom: 8 }]}
                placeholder="https://ntfy.sh"
                placeholderTextColor={COLORS.faint}
                autoCapitalize="none"
                autoCorrect={false}
                value={ntfyServer}
                onChangeText={setNtfyServer}
              />
              <ScaledText size={10} color={COLORS.buy} style={{ marginBottom: 6 }}>
                {`From Entry Bot:\ncurl -H "Title: BTCUSDT LONG" -d "entry 65000 SL 64000 TP 67000" ${(ntfyServer || 'https://ntfy.sh').replace(/\/$/, '')}/${ntfyTopic || 'YOUR_TOPIC'}`}
              </ScaledText>
              <ScaledText size={10} color={COLORS.dim}>
                {`Or JSON:\ncurl -d '{"symbol":"BTCUSDT","action":"LONG","kind":"alarm","entry":"65000","sl":"64000","tp":"67000"}' ${(ntfyServer || 'https://ntfy.sh').replace(/\/$/, '')}/${ntfyTopic || 'YOUR_TOPIC'}`}
              </ScaledText>
            </View>
          ) : null}
          {bridgeMode === 'poll' ? (
            <View style={{ marginTop: 10 }}>
              <ScaledText size={11} color={COLORS.faint} style={{ marginBottom: 4 }}>
                Poll URL (every 10s). For Entry Bot use: https://YOUR_HOST/api/alerts?limit=1
              </ScaledText>
              <TextInput
                style={[inputStyle(), { marginBottom: 8 }]}
                placeholder="https://your-server.com/api/alerts?limit=1"
                placeholderTextColor={COLORS.faint}
                autoCapitalize="none"
                autoCorrect={false}
                value={pollUrl}
                onChangeText={setPollUrl}
              />
              <ScaledText size={11} color={COLORS.faint} style={{ marginBottom: 4 }}>
                API key (sent as X-Entry-Bot-Key — from ENTRY_BOT_API_KEY)
              </ScaledText>
              <TextInput
                style={[inputStyle(), { marginBottom: 8 }]}
                placeholder="your ENTRY_BOT_API_KEY"
                placeholderTextColor={COLORS.faint}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                value={pollApiKey}
                onChangeText={setPollApiKey}
              />
              <ScaledText size={10} color={COLORS.dim}>
                Entry Bot returns alert rows; the app maps symbol/action/entry/stop/TP automatically.
              </ScaledText>
            </View>
          ) : null}
          <View style={{ marginTop: 10 }}>
            <SecondaryButton label={bridgeSaved ? 'Saved' : 'Save bridge settings'} onPress={saveBridge} />
          </View>
        </Accordion>

        <ScaledText size={11} color={COLORS.faint} style={{ textAlign: 'center', marginTop: 8 }}>
          Tentry Alarm v4.5
        </ScaledText>
      </ScrollView>
    </View>
  );
}

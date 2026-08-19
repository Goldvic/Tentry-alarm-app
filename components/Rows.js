import React from 'react';
import { View, TouchableOpacity, Switch } from 'react-native';
import ScaledText from './ScaledText';
import ScaledIcon from './ScaledIcon';
import { useSettings } from '../context/SettingsContext';
import { COLORS } from '../lib/theme';

export function SectionTitle({ children, icon }) {
  return (
    <View className="flex-row items-center mb-2">
      {icon ? <ScaledIcon name={icon} size={18} color={COLORS.text} style={{ marginRight: 8 }} /> : null}
      <ScaledText size={17} weight="700" color={COLORS.text}>
        {children}
      </ScaledText>
    </View>
  );
}

export function StatusRow({ label, ok, onFix }) {
  return (
    <View className="flex-row justify-between items-center mt-2">
      <View className="flex-row items-center flex-1 pr-2">
        <ScaledIcon
          name={ok ? 'checkmark-circle' : 'alert-circle'}
          size={17}
          color={ok ? COLORS.buy : COLORS.warn}
          style={{ marginRight: 8 }}
        />
        <ScaledText size={14} color={COLORS.dim}>
          {label}
        </ScaledText>
      </View>
      {!ok && onFix && (
        <TouchableOpacity onPress={onFix}>
          <ScaledText size={13} weight="700" color="#ff3b5c">
            Fix
          </ScaledText>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function SwitchRow({ label, sub, value, onValueChange }) {
  const { accentTokens } = useSettings();
  return (
    <View className="flex-row items-center justify-between mb-3">
      <View style={{ flex: 1, paddingRight: 12 }}>
        <ScaledText size={14} color={COLORS.text}>
          {label}
        </ScaledText>
        {sub ? (
          <ScaledText size={12} color={COLORS.faint} style={{ marginTop: 2 }}>
            {sub}
          </ScaledText>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: accentTokens.from, false: COLORS.border }} />
    </View>
  );
}

export function ChoiceRow({ options, value, onChange, getLabel = (o) => o.label, getKey = (o) => o.key }) {
  const { accentTokens } = useSettings();
  return (
    <View className="flex-row flex-wrap" style={{ marginTop: 8, marginBottom: 4 }}>
      {options.map((opt) => {
        const key = getKey(opt);
        const active = key === value;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 20,
              marginRight: 8,
              marginBottom: 8,
              backgroundColor: active ? accentTokens.from : COLORS.surface2,
              borderWidth: 1,
              borderColor: active ? accentTokens.from : COLORS.border,
            }}
          >
            <ScaledText size={13} weight="600" color={active ? '#fff' : COLORS.dim}>
              {getLabel(opt)}
            </ScaledText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

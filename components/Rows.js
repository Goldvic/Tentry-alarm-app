import React from 'react';
import { View, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import ScaledText from './ScaledText';
import ScaledIcon from './ScaledIcon';
import { useSettings } from '../context/SettingsContext';
import { COLORS, SPACE, RADIUS, LAYOUT } from '../lib/theme';

export function SectionTitle({ children, icon }) {
  return (
    <View style={styles.sectionTitle}>
      {icon ? <ScaledIcon name={icon} size={16} color={COLORS.text} style={{ marginRight: SPACE.sm }} /> : null}
      <ScaledText size={13} weight="700" color={COLORS.text}>
        {children}
      </ScaledText>
    </View>
  );
}

export function StatusRow({ label, ok, onFix }) {
  return (
    <View style={styles.statusRow}>
      <View style={styles.statusLeft}>
        <ScaledIcon
          name={ok ? 'checkmark-circle' : 'alert-circle'}
          size={16}
          color={ok ? COLORS.buy : COLORS.warn}
          style={{ marginRight: SPACE.sm }}
        />
        <ScaledText size={13} color={COLORS.dim} style={{ flex: 1 }}>
          {label}
        </ScaledText>
      </View>
      {!ok && onFix ? (
        <TouchableOpacity onPress={onFix} hitSlop={8}>
          <ScaledText size={12} weight="700" color={COLORS.warn}>
            Fix
          </ScaledText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function SwitchRow({ label, sub, value, onValueChange }) {
  const { accentTokens } = useSettings();
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1, paddingRight: SPACE.md }}>
        <ScaledText size={13} color={COLORS.text}>
          {label}
        </ScaledText>
        {sub ? (
          <ScaledText size={11} color={COLORS.faint} style={{ marginTop: 2 }}>
            {sub}
          </ScaledText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: accentTokens.from, false: COLORS.border }}
        thumbColor={COLORS.white}
      />
    </View>
  );
}

export function ChoiceRow({ options, value, onChange, getLabel = (o) => o.label, getKey = (o) => o.key }) {
  return (
    <View style={styles.choiceWrap}>
      {options.map((opt) => {
        const key = getKey(opt);
        const active = key === value;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            style={[
              styles.choice,
              active && styles.choiceActive,
            ]}
          >
            <ScaledText size={12} weight="600" color={active ? COLORS.white : COLORS.dim}>
              {getLabel(opt)}
            </ScaledText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACE.sm,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 36,
    marginTop: SPACE.xs,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: SPACE.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACE.md,
    minHeight: LAYOUT.rowMinH - 8,
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACE.sm,
    marginBottom: SPACE.xs,
  },
  choice: {
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.full,
    marginRight: SPACE.sm,
    marginBottom: SPACE.sm,
    backgroundColor: COLORS.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  choiceActive: {
    backgroundColor: COLORS.edge,
    borderColor: COLORS.dim,
  },
});

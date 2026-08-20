import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import ScaledText from './ScaledText';
import { useSettings } from '../context/SettingsContext';
import { COLORS } from '../lib/theme';

function Hand({ length, width, color, deg }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width,
        height: length * 2,
        left: '50%',
        top: '50%',
        marginLeft: -width / 2,
        marginTop: -length,
        alignItems: 'center',
        transform: [{ rotate: `${deg}deg` }],
      }}
    >
      <View style={{ width, height: length, backgroundColor: color, borderRadius: width }} />
    </View>
  );
}

/** Minimalist neumorphic analog clock + live day/date window */
export default function AnalogClock({ size = 196 }) {
  const [now, setNow] = useState(new Date());
  const { accentTokens } = useSettings();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const s = now.getSeconds();
  const hourDeg = h * 30 + m * 0.5;
  const minDeg = m * 6 + s * 0.1;
  const secDeg = s * 6;

  const day = now.toLocaleDateString(undefined, { weekday: 'long' });
  const date = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const face = size - 18;

  return (
    <View style={styles.wrap}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: COLORS.surface,
          borderWidth: 1,
          borderColor: COLORS.border,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.5,
          shadowRadius: 14,
          shadowOffset: { width: 4, height: 8 },
          elevation: 12,
        }}
      >
        <View
          style={{
            width: face,
            height: face,
            borderRadius: face / 2,
            backgroundColor: '#0a0e18',
            borderWidth: 1,
            borderColor: accentTokens.from + '40',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {Array.from({ length: 12 }).map((_, i) => {
            const rad = (i * 30 * Math.PI) / 180;
            const isMajor = i % 3 === 0;
            const len = isMajor ? 11 : 5;
            const cx = face / 2;
            const cy = face / 2;
            const outer = face / 2 - 7;
            const x = cx + Math.sin(rad) * outer;
            const y = cy - Math.cos(rad) * outer;
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  width: isMajor ? 2.5 : 1.5,
                  height: len,
                  backgroundColor: isMajor ? accentTokens.from : COLORS.faint,
                  borderRadius: 2,
                  left: x - 1.2,
                  top: y - len / 2,
                  transform: [{ rotate: `${i * 30}deg` }],
                }}
              />
            );
          })}

          <Hand length={face * 0.25} width={3.5} color={COLORS.text} deg={hourDeg} />
          <Hand length={face * 0.34} width={2.5} color={COLORS.dim} deg={minDeg} />
          <Hand length={face * 0.38} width={1.5} color={accentTokens.from} deg={secDeg} />

          <View
            style={{
              position: 'absolute',
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: accentTokens.from,
              borderWidth: 2,
              borderColor: '#fff',
              zIndex: 5,
            }}
          />
        </View>
      </View>

      <View style={styles.dateWindow}>
        <View style={[styles.datePill, { borderColor: accentTokens.from + '55' }]}>
          <ScaledText size={10} weight="800" color={accentTokens.from} style={{ letterSpacing: 1.4 }}>
            {day.toUpperCase()}
          </ScaledText>
        </View>
        <ScaledText size={12} weight="600" color={COLORS.text} style={{ marginTop: 5 }}>
          {date}
        </ScaledText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginVertical: 6 },
  dateWindow: { alignItems: 'center', marginTop: 10 },
  datePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
  },
});

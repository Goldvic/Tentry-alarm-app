import React, { useMemo, useState } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import Card from '../components/Card';
import AppHeader from '../components/AppHeader';
import ScaledText from '../components/ScaledText';
import { useSettings } from '../context/SettingsContext';
import { COLORS } from '../lib/theme';

function num(v) {
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <ScaledText size={11} color={COLORS.faint} style={{ marginBottom: 3 }}>{label}</ScaledText>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder || '0'}
        placeholderTextColor={COLORS.faint}
        keyboardType="decimal-pad"
        style={{
          backgroundColor: '#0a0d18', color: COLORS.text, borderRadius: 8, padding: 10,
          fontSize: 14, borderWidth: 1, borderColor: COLORS.border,
        }}
      />
    </View>
  );
}

function Result({ label, value, color }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <ScaledText size={12} color={COLORS.dim}>{label}</ScaledText>
      <ScaledText size={13} weight="700" color={color || COLORS.text}>{value}</ScaledText>
    </View>
  );
}

const TABS = [
  { key: 'std', label: 'Standard' },
  { key: 'pos', label: 'Position' },
  { key: 'rr', label: 'R:R' },
  { key: 'pl', label: 'P/L' },
];

function StandardCalc() {
  const { accentTokens } = useSettings();
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState(null);
  const [op, setOp] = useState(null);
  const [fresh, setFresh] = useState(true);

  const input = (d) => {
    if (fresh) {
      setDisplay(d === '.' ? '0.' : d);
      setFresh(false);
    } else {
      if (d === '.' && display.includes('.')) return;
      setDisplay(display === '0' && d !== '.' ? d : display + d);
    }
  };

  const clear = () => {
    setDisplay('0');
    setPrev(null);
    setOp(null);
    setFresh(true);
  };

  const doOp = (nextOp) => {
    const cur = parseFloat(display);
    if (prev != null && op && !fresh) {
      const result = compute(prev, cur, op);
      setDisplay(String(result));
      setPrev(result);
    } else {
      setPrev(cur);
    }
    setOp(nextOp);
    setFresh(true);
  };

  const compute = (a, b, operator) => {
    switch (operator) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b === 0 ? 0 : a / b;
      default: return b;
    }
  };

  const equals = () => {
    if (prev == null || !op) return;
    const cur = parseFloat(display);
    const result = compute(prev, cur, op);
    setDisplay(String(result));
    setPrev(null);
    setOp(null);
    setFresh(true);
  };

  const backspace = () => {
    if (fresh || display.length <= 1) {
      setDisplay('0');
      setFresh(true);
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const btn = (label, onPress, wide, accent) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: wide ? 2 : 1,
        margin: 3,
        height: 48,
        borderRadius: 10,
        backgroundColor: accent ? accentTokens.from : COLORS.surface2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: accent ? accentTokens.from : COLORS.border,
      }}
    >
      <ScaledText size={16} weight="700" color={accent ? '#fff' : COLORS.text}>{label}</ScaledText>
    </TouchableOpacity>
  );

  return (
    <View>
      <Card style={{ padding: 12, marginBottom: 8 }}>
        <ScaledText size={28} weight="800" color={COLORS.text} style={{ textAlign: 'right' }} numberOfLines={1}>
          {display}
        </ScaledText>
        {op && prev != null ? (
          <ScaledText size={11} color={COLORS.faint} style={{ textAlign: 'right', marginTop: 2 }}>
            {prev} {op}
          </ScaledText>
        ) : null}
      </Card>
      <View style={{ flexDirection: 'row' }}>
        {btn('C', clear)}
        {btn('⌫', backspace)}
        {btn('÷', () => doOp('÷'), false, true)}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {btn('7', () => input('7'))}
        {btn('8', () => input('8'))}
        {btn('9', () => input('9'))}
        {btn('×', () => doOp('×'), false, true)}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {btn('4', () => input('4'))}
        {btn('5', () => input('5'))}
        {btn('6', () => input('6'))}
        {btn('-', () => doOp('-'), false, true)}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {btn('1', () => input('1'))}
        {btn('2', () => input('2'))}
        {btn('3', () => input('3'))}
        {btn('+', () => doOp('+'), false, true)}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {btn('0', () => input('0'), true)}
        {btn('.', () => input('.'))}
        {btn('=', equals, false, true)}
      </View>
    </View>
  );
}

export default function CalculatorScreen() {
  const { accentTokens } = useSettings();
  const [tab, setTab] = useState('std');

  const [account, setAccount] = useState('10000');
  const [riskPct, setRiskPct] = useState('1');
  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('');
  const [pipValue, setPipValue] = useState('10');

  const [rrEntry, setRrEntry] = useState('');
  const [rrSl, setRrSl] = useState('');
  const [rrTp, setRrTp] = useState('');

  const [plEntry, setPlEntry] = useState('');
  const [plExit, setPlExit] = useState('');
  const [plLots, setPlLots] = useState('1');
  const [plPipValue, setPlPipValue] = useState('10');
  const [isLong, setIsLong] = useState(true);

  const position = useMemo(() => {
    const bal = num(account);
    const risk = num(riskPct) / 100;
    const e = num(entry);
    const s = num(stop);
    const pv = num(pipValue) || 10;
    if (!bal || !risk || !e || !s || e === s) return { riskAmount: 0, distance: 0, lots: 0 };
    const riskAmount = bal * risk;
    const distance = Math.abs(e - s);
    const lots = distance > 0 ? riskAmount / (distance * pv) : 0;
    return { riskAmount, distance, lots };
  }, [account, riskPct, entry, stop, pipValue]);

  const rr = useMemo(() => {
    const e = num(rrEntry);
    const s = num(rrSl);
    const t = num(rrTp);
    if (!e || !s || !t || e === s) return { risk: 0, reward: 0, ratio: 0 };
    const risk = Math.abs(e - s);
    const reward = Math.abs(t - e);
    return { risk, reward, ratio: risk > 0 ? reward / risk : 0 };
  }, [rrEntry, rrSl, rrTp]);

  const pl = useMemo(() => {
    const e = num(plEntry);
    const x = num(plExit);
    const lots = num(plLots);
    const pv = num(plPipValue) || 10;
    if (!e || !x) return { points: 0, pnl: 0 };
    const points = isLong ? x - e : e - x;
    return { points, pnl: points * lots * pv };
  }, [plEntry, plExit, plLots, plPipValue, isLong]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <AppHeader title="Calculator" subtitle="Standard · Trading tools" />
      <View
        style={{
          flexDirection: 'row', marginHorizontal: 14, marginBottom: 8,
          backgroundColor: COLORS.surface, borderRadius: 10, padding: 3,
          borderWidth: 1, borderColor: COLORS.border,
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center',
                backgroundColor: active ? accentTokens.from : 'transparent',
              }}
            >
              <ScaledText size={10} weight="700" color={active ? '#fff' : COLORS.faint}>{t.label}</ScaledText>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 32 }}>
        {tab === 'std' && <StandardCalc />}

        {tab === 'pos' && (
          <Card style={{ padding: 12 }}>
            <Field label="Account ($)" value={account} onChange={setAccount} />
            <Field label="Risk (%)" value={riskPct} onChange={setRiskPct} />
            <Field label="Entry" value={entry} onChange={setEntry} />
            <Field label="Stop" value={stop} onChange={setStop} />
            <Field label="$ / point (1 lot)" value={pipValue} onChange={setPipValue} />
            <View style={{ marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border }}>
              <Result label="Risk $" value={`$${position.riskAmount.toFixed(2)}`} />
              <Result label="Distance" value={position.distance.toFixed(4)} />
              <Result label="Lots" value={position.lots.toFixed(3)} color={accentTokens.from} />
            </View>
          </Card>
        )}

        {tab === 'rr' && (
          <Card style={{ padding: 12 }}>
            <Field label="Entry" value={rrEntry} onChange={setRrEntry} />
            <Field label="SL" value={rrSl} onChange={setRrSl} />
            <Field label="TP" value={rrTp} onChange={setRrTp} />
            <View style={{ marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border }}>
              <Result label="Risk" value={rr.risk.toFixed(4)} color={COLORS.sell} />
              <Result label="Reward" value={rr.reward.toFixed(4)} color={COLORS.buy} />
              <Result label="R:R" value={rr.ratio > 0 ? `1 : ${rr.ratio.toFixed(2)}` : '—'} color={accentTokens.from} />
            </View>
          </Card>
        )}

        {tab === 'pl' && (
          <Card style={{ padding: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <TouchableOpacity
                onPress={() => setIsLong(true)}
                style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: isLong ? COLORS.buy : COLORS.surface2, alignItems: 'center' }}
              >
                <ScaledText size={12} weight="700" color={isLong ? '#fff' : COLORS.dim}>LONG</ScaledText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsLong(false)}
                style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: !isLong ? COLORS.sell : COLORS.surface2, alignItems: 'center' }}
              >
                <ScaledText size={12} weight="700" color={!isLong ? '#fff' : COLORS.dim}>SHORT</ScaledText>
              </TouchableOpacity>
            </View>
            <Field label="Entry" value={plEntry} onChange={setPlEntry} />
            <Field label="Exit" value={plExit} onChange={setPlExit} />
            <Field label="Lots" value={plLots} onChange={setPlLots} />
            <Field label="$ / point" value={plPipValue} onChange={setPlPipValue} />
            <View style={{ marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border }}>
              <Result label="Points" value={pl.points.toFixed(4)} />
              <Result label="P/L" value={`${pl.pnl >= 0 ? '+' : ''}$${pl.pnl.toFixed(2)}`} color={pl.pnl >= 0 ? COLORS.buy : COLORS.sell} />
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

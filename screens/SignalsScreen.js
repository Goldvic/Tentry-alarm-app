import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import Card from '../components/Card';
import AppHeader from '../components/AppHeader';
import ScaledText from '../components/ScaledText';
import ScaledIcon from '../components/ScaledIcon';
import { SecondaryButton } from '../components/Buttons';
import { COLORS, SPACE, RADIUS, LAYOUT } from '../lib/theme';

function parseSignal(entry) {
  const msg = entry.message || entry.body || '';
  const data = entry.data || {};
  return {
    symbol: data.symbol || entry.symbol || (msg.match(/([A-Z]{2,}USDT?|[A-Z]{3,}\/[A-Z]{3})/i) || [])[0] || '—',
    action: (data.action || entry.action || (msg.match(/\b(BUY|SELL|LONG|SHORT)\b/i) || [])[0] || '—').toUpperCase(),
    entry: data.entry || entry.entry || null,
    tp: data.tp || data.takeProfit || entry.tp || null,
    sl: data.sl || data.stopLoss || entry.sl || null,
    message: msg,
    time: entry.time || entry.timestamp || '',
    raw: entry,
  };
}

export default function SignalsScreen({ signals = [] }) {
  const [selected, setSelected] = useState(null);

  return (
    <View style={styles.root}>
      <AppHeader title="Signals" subtitle="From Entry Bot" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {signals.length === 0 ? (
          <Card>
            <View style={styles.empty}>
              <ScaledIcon name="flash-outline" size={32} color={COLORS.faint} />
              <ScaledText size={13} color={COLORS.faint} style={styles.emptyText}>
                No signals yet. When your Entry Bot sends a push, it will appear here.
              </ScaledText>
            </View>
          </Card>
        ) : (
          signals.map((s, i) => {
            const p = parseSignal(s);
            const isBuy = p.action === 'BUY' || p.action === 'LONG';
            const isSell = p.action === 'SELL' || p.action === 'SHORT';
            const sideColor = isBuy ? COLORS.buy : isSell ? COLORS.sell : COLORS.faint;
            return (
              <TouchableOpacity key={i} activeOpacity={0.75} onPress={() => setSelected(p)}>
                <Card>
                  <View style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: sideColor }]} />
                    <View style={{ flex: 1 }}>
                      <ScaledText size={15} weight="700" color={COLORS.text}>
                        {p.symbol}
                      </ScaledText>
                      <ScaledText size={11} color={COLORS.faint} style={{ marginTop: 2 }}>
                        {typeof p.time === 'number' ? new Date(p.time).toLocaleString() : String(p.time || '')}
                      </ScaledText>
                    </View>
                    <View style={[styles.chip, { backgroundColor: sideColor + '22' }]}>
                      <ScaledText size={11} weight="800" color={sideColor}>
                        {p.action}
                      </ScaledText>
                    </View>
                  </View>
                  {(p.entry || p.tp || p.sl) ? (
                    <View style={styles.levels}>
                      {p.entry != null && (
                        <ScaledText size={11} color={COLORS.dim}>
                          Entry{' '}
                          <ScaledText size={11} weight="700" color={COLORS.text}>{String(p.entry)}</ScaledText>
                        </ScaledText>
                      )}
                      {p.tp != null && (
                        <ScaledText size={11} color={COLORS.dim}>
                          TP{' '}
                          <ScaledText size={11} weight="700" color={COLORS.buy}>{String(p.tp)}</ScaledText>
                        </ScaledText>
                      )}
                      {p.sl != null && (
                        <ScaledText size={11} color={COLORS.dim}>
                          SL{' '}
                          <ScaledText size={11} weight="700" color={COLORS.sell}>{String(p.sl)}</ScaledText>
                        </ScaledText>
                      )}
                    </View>
                  ) : null}
                </Card>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {selected && (
              <>
                <View style={styles.modalHead}>
                  <ScaledText size={18} weight="800" color={COLORS.text}>
                    {selected.symbol}
                  </ScaledText>
                  <TouchableOpacity onPress={() => setSelected(null)} hitSlop={10}>
                    <ScaledIcon name="close" size={22} color={COLORS.faint} />
                  </TouchableOpacity>
                </View>
                <View
                  style={[
                    styles.chip,
                    {
                      alignSelf: 'flex-start',
                      marginBottom: SPACE.md,
                      backgroundColor:
                        (selected.action === 'BUY' || selected.action === 'LONG' ? COLORS.buy : COLORS.sell) + '22',
                    },
                  ]}
                >
                  <ScaledText
                    size={12}
                    weight="800"
                    color={selected.action === 'BUY' || selected.action === 'LONG' ? COLORS.buy : COLORS.sell}
                  >
                    {selected.action}
                  </ScaledText>
                </View>
                {selected.entry != null && (
                  <ScaledText size={13} color={COLORS.dim} style={styles.detailLine}>
                    Entry{' '}
                    <ScaledText size={13} weight="700" color={COLORS.text}>{String(selected.entry)}</ScaledText>
                  </ScaledText>
                )}
                {selected.tp != null && (
                  <ScaledText size={13} color={COLORS.dim} style={styles.detailLine}>
                    Take Profit{' '}
                    <ScaledText size={13} weight="700" color={COLORS.buy}>{String(selected.tp)}</ScaledText>
                  </ScaledText>
                )}
                {selected.sl != null && (
                  <ScaledText size={13} color={COLORS.dim} style={styles.detailLine}>
                    Stop Loss{' '}
                    <ScaledText size={13} weight="700" color={COLORS.sell}>{String(selected.sl)}</ScaledText>
                  </ScaledText>
                )}
                <ScaledText size={12} color={COLORS.faint} style={{ marginTop: SPACE.sm, marginBottom: SPACE.md }}>
                  {typeof selected.time === 'number'
                    ? new Date(selected.time).toLocaleString()
                    : String(selected.time || '')}
                </ScaledText>
                {selected.message ? (
                  <ScaledText size={13} color={COLORS.dim} style={{ lineHeight: 20, marginBottom: SPACE.lg }}>
                    {selected.message}
                  </ScaledText>
                ) : null}
                <SecondaryButton label="Close" onPress={() => setSelected(null)} />
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: {
    paddingHorizontal: LAYOUT.screenPadH,
    paddingBottom: LAYOUT.screenPadBottom,
    paddingTop: SPACE.xs,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: SPACE.xxl,
  },
  emptyText: {
    marginTop: SPACE.md,
    textAlign: 'center',
    paddingHorizontal: SPACE.md,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACE.md,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  levels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.md,
    marginTop: SPACE.sm + 2,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACE.lg,
    paddingBottom: SPACE.xxl + 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACE.md,
  },
  detailLine: {
    marginBottom: SPACE.xs + 2,
  },
});

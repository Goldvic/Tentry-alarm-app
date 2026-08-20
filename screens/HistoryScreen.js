import React, { useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, Share } from 'react-native';
import Card from '../components/Card';
import ScaledText from '../components/ScaledText';
import ScaledIcon from '../components/ScaledIcon';
import { SecondaryButton } from '../components/Buttons';
import { COLORS } from '../lib/theme';

export default function HistoryScreen({ alarmHistory = [], onClearHistory, embedded }) {
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const filtered = useMemo(() => {
    let list = alarmHistory || [];
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (a) =>
          (a.title || '').toLowerCase().includes(q) ||
          (a.message || a.body || '').toLowerCase().includes(q) ||
          (a.symbol || '').toLowerCase().includes(q)
      );
    }
    if (dateFilter) {
      list = list.filter((a) => {
        const ts = a.timestamp || a.time || a.date;
        if (!ts) return false;
        const d = new Date(typeof ts === 'number' ? ts : Date.parse(ts));
        if (isNaN(d.getTime())) return false;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return key === dateFilter;
      });
    }
    return list;
  }, [alarmHistory, query, dateFilter]);

  const onExport = async () => {
    try {
      const text = filtered
        .map((a) => {
          const t = a.timestamp ? new Date(a.timestamp).toISOString() : a.time || '';
          return `${t} | ${a.title || a.symbol || 'Alarm'} | ${a.message || a.body || ''}`;
        })
        .join('\n');
      await Share.share({ message: text || 'No history', title: 'Tentry Alarm History' });
    } catch (e) {}
  };

  const padTop = embedded ? 8 : 16;

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingHorizontal: 12, paddingTop: padTop, paddingBottom: 24 }}>
      {!embedded && (
        <View className="flex-row items-center justify-between mb-3">
          <ScaledText size={18} weight="800" color={COLORS.text}>History</ScaledText>
          {alarmHistory.length > 0 && (
            <TouchableOpacity onPress={onClearHistory} className="flex-row items-center">
              <ScaledIcon name="trash" size={14} color={COLORS.sell} style={{ marginRight: 4 }} />
              <ScaledText size={12} weight="700" color={COLORS.sell}>Clear</ScaledText>
            </TouchableOpacity>
          )}
        </View>
      )}
      {embedded && alarmHistory.length > 0 && (
        <View style={{ alignItems: 'flex-end', marginBottom: 8 }}>
          <TouchableOpacity onPress={onClearHistory}>
            <ScaledText size={12} weight="700" color={COLORS.sell}>Clear</ScaledText>
          </TouchableOpacity>
        </View>
      )}

      <Card style={{ padding: 10, marginBottom: 10 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search…"
          placeholderTextColor={COLORS.faint}
          style={{ backgroundColor: '#0a0d18', color: COLORS.text, borderRadius: 8, padding: 10, fontSize: 13, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 }}
        />
        <TextInput
          value={dateFilter}
          onChangeText={setDateFilter}
          placeholder="Date YYYY-MM-DD"
          placeholderTextColor={COLORS.faint}
          style={{ backgroundColor: '#0a0d18', color: COLORS.text, borderRadius: 8, padding: 10, fontSize: 13, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 }}
        />
        <SecondaryButton label="Export" onPress={onExport} icon={<ScaledIcon name="share-outline" size={14} color={COLORS.text} />} />
      </Card>

      {filtered.length === 0 ? (
        <Card style={{ padding: 16 }}>
          <View className="items-center py-4">
            <ScaledIcon name="file-tray" size={28} color={COLORS.faint} />
            <ScaledText size={12} color={COLORS.faint} style={{ marginTop: 8, textAlign: 'center' }}>
              {alarmHistory.length === 0 ? 'No alarm history yet.' : 'No matches.'}
            </ScaledText>
          </View>
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.map((h, i) => {
            const isBuy = /buy|long/i.test(h.message || h.body || h.action || '');
            const isSell = /sell|short/i.test(h.message || h.body || h.action || '');
            const dotColor = isBuy ? COLORS.buy : isSell ? COLORS.sell : COLORS.faint;
            const timeLabel =
              h.timeLabel ||
              (h.timestamp
                ? new Date(h.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : h.time || '');
            return (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: COLORS.border,
                }}
              >
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor, marginRight: 10 }} />
                <View style={{ flex: 1, marginRight: 6 }}>
                  <ScaledText size={12} weight="600" color={COLORS.text}>{h.title || h.symbol || 'Alarm'}</ScaledText>
                  <ScaledText size={11} color={COLORS.dim} numberOfLines={1}>{h.message || h.body || ''}</ScaledText>
                </View>
                <ScaledText size={10} color={COLORS.faint}>{timeLabel}</ScaledText>
              </View>
            );
          })}
        </Card>
      )}
    </ScrollView>
  );
}

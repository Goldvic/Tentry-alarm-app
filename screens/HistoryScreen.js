import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import Card from '../components/Card';
import ScaledText from '../components/ScaledText';
import ScaledIcon from '../components/ScaledIcon';
import { COLORS } from '../lib/theme';

export default function HistoryScreen({ history, onClearHistory }) {
  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 20, paddingTop: 64, paddingBottom: 40 }}>
      <View className="flex-row items-center justify-between mb-6">
        <ScaledText size={26} weight="800" color={COLORS.text}>
          Signal History
        </ScaledText>
        {history.length > 0 && (
          <TouchableOpacity onPress={onClearHistory} className="flex-row items-center">
            <ScaledIcon name="trash" size={16} color={COLORS.sell} style={{ marginRight: 4 }} />
            <ScaledText size={13} weight="700" color={COLORS.sell}>
              Clear
            </ScaledText>
          </TouchableOpacity>
        )}
      </View>

      {history.length === 0 ? (
        <Card>
          <View className="items-center py-8">
            <ScaledIcon name="file-tray" size={34} color={COLORS.faint} />
            <ScaledText size={14} color={COLORS.faint} style={{ marginTop: 10, textAlign: 'center' }}>
              No signals yet. Send a test signal from Settings to see one here.
            </ScaledText>
          </View>
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {history.map((h, i) => {
            const isBuy = /buy/i.test(h.message || '');
            const isSell = /sell/i.test(h.message || '');
            const dotColor = isBuy ? COLORS.buy : isSell ? COLORS.sell : COLORS.faint;
            return (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: COLORS.border,
                }}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor, marginRight: 12 }} />
                <ScaledText size={13} color={COLORS.text} style={{ flex: 1, marginRight: 8 }}>
                  {h.message}
                </ScaledText>
                <ScaledText size={12} color={COLORS.faint}>
                  {h.time}
                </ScaledText>
              </View>
            );
          })}
        </Card>
      )}
    </ScrollView>
  );
}

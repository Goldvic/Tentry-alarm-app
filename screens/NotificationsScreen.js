import React from 'react';
import { View, ScrollView } from 'react-native';
import Card from '../components/Card';
import ScaledText from '../components/ScaledText';
import ScaledIcon from '../components/ScaledIcon';
import { COLORS } from '../lib/theme';

export default function NotificationsScreen({ notificationLog = [], embedded }) {
  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingHorizontal: 12, paddingTop: embedded ? 8 : 16, paddingBottom: 24 }}>
      {!embedded && (
        <>
          <ScaledText size={18} weight="800" color={COLORS.text} style={{ marginBottom: 4 }}>
            Notifications
          </ScaledText>
          <ScaledText size={12} color={COLORS.faint} style={{ marginBottom: 12 }}>
            Complete log of every push received
          </ScaledText>
        </>
      )}

      {notificationLog.length === 0 ? (
        <Card>
          <View className="items-center py-10">
            <ScaledIcon name="notifications-outline" size={36} color={COLORS.faint} />
            <ScaledText size={14} color={COLORS.faint} style={{ marginTop: 12, textAlign: 'center' }}>
              No notifications logged yet.
            </ScaledText>
          </View>
        </Card>
      ) : (
        notificationLog.map((n, i) => {
          const isSignal = n.kind === 'signal' || n.isSignal || (n.data && n.data.kind === 'alarm');
          return (
            <Card key={i} style={{ borderLeftWidth: 3, borderLeftColor: isSignal ? COLORS.buy : COLORS.faint }}>
              <View className="flex-row items-center justify-between mb-1">
                <View className="flex-row items-center">
                  <ScaledIcon
                    name={isSignal ? 'flash' : 'notifications'}
                    size={14}
                    color={isSignal ? COLORS.buy : COLORS.faint}
                    style={{ marginRight: 6 }}
                  />
                  <ScaledText size={12} weight="700" color={isSignal ? COLORS.buy : COLORS.faint}>
                    {isSignal ? 'SIGNAL' : 'OTHER'}
                  </ScaledText>
                </View>
                <ScaledText size={11} color={COLORS.faint}>
                  {n.time || n.timestamp || ''}
                </ScaledText>
              </View>
              <ScaledText size={14} weight="600" color={COLORS.text}>
                {n.title || 'Notification'}
              </ScaledText>
              <ScaledText size={13} color={COLORS.dim} style={{ marginTop: 4 }}>
                {n.body || n.message || ''}
              </ScaledText>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

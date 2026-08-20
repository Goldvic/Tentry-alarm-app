import React, { useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import Card from '../components/Card';
import ScaledText from '../components/ScaledText';
import ScaledIcon from '../components/ScaledIcon';
import { useSettings } from '../context/SettingsContext';
import { COLORS } from '../lib/theme';

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildMonthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay(); // 0 Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function CalendarScreen({ alarmHistory = [], embedded }) {
  const { accentTokens } = useSettings();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);

  const countsByDay = useMemo(() => {
    const map = {};
    for (const a of alarmHistory) {
      const ts = a.timestamp || a.time || a.date;
      if (!ts) continue;
      const d = new Date(typeof ts === 'number' ? ts : Date.parse(ts));
      if (isNaN(d.getTime())) continue;
      const k = dayKey(d);
      map[k] = (map[k] || 0) + 1;
    }
    return map;
  }, [alarmHistory]);

  const cells = useMemo(() => buildMonthMatrix(year, month), [year, month]);

  const dayAlarms = useMemo(() => {
    if (!selectedDay) return [];
    const k = dayKey(selectedDay);
    return alarmHistory.filter((a) => {
      const ts = a.timestamp || a.time || a.date;
      if (!ts) return false;
      const d = new Date(typeof ts === 'number' ? ts : Date.parse(ts));
      return dayKey(d) === k;
    });
  }, [selectedDay, alarmHistory]);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
    setSelectedDay(null);
  };

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingHorizontal: 12, paddingTop: embedded ? 8 : 16, paddingBottom: 24 }}>
      {!embedded && (
        <ScaledText size={18} weight="800" color={COLORS.text} style={{ marginBottom: 12 }}>
          Calendar
        </ScaledText>
      )}

      <Card>
        <View className="flex-row items-center justify-between mb-4">
          <TouchableOpacity onPress={prevMonth} style={{ padding: 8 }}>
            <ScaledIcon name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <ScaledText size={17} weight="700" color={COLORS.text}>
            {MONTH_NAMES[month]} {year}
          </ScaledText>
          <TouchableOpacity onPress={nextMonth} style={{ padding: 8 }}>
            <ScaledIcon name="chevron-forward" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <View className="flex-row mb-2">
          {WEEKDAYS.map((w, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <ScaledText size={11} weight="600" color={COLORS.faint}>
                {w}
              </ScaledText>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((d, i) => {
            if (!d) {
              return <View key={i} style={{ width: '14.28%', height: 44 }} />;
            }
            const k = dayKey(d);
            const count = countsByDay[k] || 0;
            const isSelected = selectedDay && dayKey(selectedDay) === k;
            const isToday = dayKey(now) === k;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => setSelectedDay(d)}
                style={{
                  width: '14.28%',
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected
                      ? accentTokens.from
                      : isToday
                      ? COLORS.surface2
                      : 'transparent',
                    borderWidth: isToday && !isSelected ? 1 : 0,
                    borderColor: accentTokens.from,
                  }}
                >
                  <ScaledText
                    size={13}
                    weight={count > 0 || isSelected ? '700' : '500'}
                    color={isSelected ? '#fff' : count > 0 ? COLORS.text : COLORS.dim}
                  >
                    {d.getDate()}
                  </ScaledText>
                </View>
                {count > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 2,
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: isSelected ? '#fff' : accentTokens.from,
                    }}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      {selectedDay && (
        <Card>
          <ScaledText size={15} weight="700" color={COLORS.text} style={{ marginBottom: 10 }}>
            {selectedDay.toLocaleDateString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </ScaledText>
          {dayAlarms.length === 0 ? (
            <ScaledText size={13} color={COLORS.faint}>
              No alarms rang this day.
            </ScaledText>
          ) : (
            dayAlarms.map((a, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: COLORS.border,
                }}
              >
                <ScaledIcon name="alarm" size={16} color={accentTokens.from} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <ScaledText size={13} weight="600" color={COLORS.text}>
                    {a.title || a.symbol || 'Alarm'}
                  </ScaledText>
                  <ScaledText size={12} color={COLORS.faint}>
                    {a.message || a.body || ''}
                  </ScaledText>
                </View>
                <ScaledText size={11} color={COLORS.faint}>
                  {a.timeLabel ||
                    (a.timestamp
                      ? new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '')}
                </ScaledText>
              </View>
            ))
          )}
        </Card>
      )}
    </ScrollView>
  );
}

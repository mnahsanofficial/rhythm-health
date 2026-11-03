import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SPACING } from '@rhythm-health/brand';
import { Action, Copy, useStyles, Title } from './ui';
import { useColors } from './theme-core';

/** Calendar date is arbitrary: profile times are local wall-clock HH:MM, never UTC instants. */
function clockDate(value: string, fallback: string) {
  const valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
  const [hour, minute] = valid.split(':').map(Number);
  return new Date(2000, 0, 1, hour, minute);
}
function clockValue(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { const COLORS = useColors(); const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState(() => clockDate(value, label === 'Bedtime' ? '23:00' : '07:00'));
  function select(event: DateTimePickerEvent, date?: Date) {
    if (event.type === 'dismissed') { setOpen(false); return; }
    if (!date) return;
    if (Platform.OS === 'android') { setOpen(false); if (clockValue(date) !== value) onChange(clockValue(date)); }
    else setSelection(date);
  }
  const picker = <DateTimePicker accessibilityLabel="Time picker" value={selection} mode="time" is24Hour
    display={Platform.OS === 'android' ? 'clock' : 'spinner'} onChange={select}
    themeVariant="light" textColor={COLORS.ink} accentColor={COLORS.moss} />;
  return <View style={styles.stack}>
    <Copy style={styles.label}>{label}</Copy>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Opens the time picker"
      accessibilityValue={{ text: value || 'No time chosen' }} style={[styles.action, styles.secondary]}
      onPress={() => { setSelection(clockDate(value, label === 'Bedtime' ? '23:00' : '07:00')); setOpen(true); }}>
      <Copy style={styles.number}>{value || 'Choose a time'}</Copy>
    </Pressable>
    {open && (Platform.OS === 'android' ? picker : <Modal visible transparent={false} animationType="none" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={{ padding: SPACING.lg, flexGrow: 1, justifyContent: 'center' }}>
        <View accessibilityViewIsModal style={styles.stack}>
          <Title>{label}</Title>
          <Copy>Choose your usual time.</Copy>
          {picker}
          <Action label="Use this time" onPress={() => { if (clockValue(selection) !== value) onChange(clockValue(selection)); setOpen(false); }} />
          <Action label="Cancel time selection" secondary onPress={() => setOpen(false)} />
        </View>
      </ScrollView></SafeAreaView>
    </Modal>)}
  </View>;
}

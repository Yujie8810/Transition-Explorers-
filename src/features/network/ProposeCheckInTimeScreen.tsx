import { Text, TextInput } from '../../components/Typography';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../components/Screen';
import { AppButton } from '../../components/AppButton';
import { useNetwork } from './NetworkProvider';
import { usePeople } from '../people/PeopleProvider';
import { styles } from './styles';
import type { CheckIn } from '../../types';

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const timeKey = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
export default function ProposeCheckInTimeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const network = useNetwork();
  if (!network.ready) return <Screen title="Propose a new time"><Text>{network.loadError || 'Loading invitation…'}</Text>
    {network.loadError ? <AppButton label="Retry" onPress={network.reload} /> : null}</Screen>;
  const meeting = network.incomingCheckIns.find(item => item.id === id);
  if (!meeting || meeting.status === 'cancelled') return <Screen title="Invitation unavailable"><Text>This invitation is no longer available.</Text></Screen>;
  return <ProposalForm key={meeting.id} meeting={meeting} />;
}
function ProposalForm({ meeting }: { meeting: CheckIn }) {
  const network = useNetwork();
  const { guides } = usePeople();
  // Capture the version being reviewed. The server rejects a stale proposal if
  // the sender edits/cancels this invitation while the form is open.
  const [revision] = useState(meeting.revision ?? 1);
  const [date, setDate] = useState(dateKey(new Date(meeting.startsAt)));
  const [time, setTime] = useState(timeKey(new Date(meeting.startsAt)));
  const [duration, setDuration] = useState<15 | 30>(meeting.durationMinutes);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const starts = new Date(`${date}T${time}:00`);
  const name = guides.find(item => item.id === meeting.senderId)?.name ?? 'the original sender';
  const validate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
      || !Number.isFinite(starts.getTime()) || dateKey(starts) !== date || timeKey(starts) !== time) return 'Enter a valid date (YYYY-MM-DD) and time (HH:mm).';
    if (starts.getTime() <= Date.now()) return 'Choose a future date and time.';
    if (starts.getTime() === Date.parse(meeting.startsAt) && duration === meeting.durationMinutes) return 'Choose a different time or duration.';
    return '';
  };
  const send = async () => {
    if (busy) return;
    const problem = validate(); if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    try { await network.proposeTime(meeting.id, revision, starts.toISOString(), duration); setSent(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send. Your proposed time is kept.'); }
    finally { setBusy(false); }
  };
  if (sent) return <Screen title="New time proposed" subtitle={`${name} can accept or reject your proposal in Your Circle.`}>
    <Text style={styles.body}>The original time stays unchanged until they accept.</Text>
    <AppButton label="View Your Circle" onPress={() => router.replace('/network')} />
  </Screen>;
  return <Screen title={review ? 'Review your proposed time' : 'Propose a new time'} subtitle={`Send a new time to ${name}.`}>
    <View style={styles.card}><Text style={styles.title}>{meeting.topic}</Text>
      <Text style={styles.label}>Original time</Text>
      <Text style={styles.body}>{new Date(meeting.startsAt).toLocaleString()} · {meeting.durationMinutes} minutes</Text>
    </View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {review ? <>
      <View style={styles.card}><Text style={styles.label}>Proposed time</Text>
        <Text style={styles.body}>{starts.toLocaleString()} · {duration} minutes</Text>
        <Text style={styles.body}>Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</Text>
      </View>
      <Text style={styles.body}>The original time remains unchanged while you wait. Accepting the new time confirms it for both of you.</Text>
      <AppButton label={busy ? 'Sending…' : 'Send new time proposal'} disabled={busy} onPress={() => void send()} />
      <AppButton label="Edit proposed time" variant="secondary" disabled={busy} onPress={() => setReview(false)} />
    </> : <>
      <Text style={styles.label}>New date</Text>
      <TextInput accessibilityLabel="Proposed check-in date" placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} style={styles.input} autoCapitalize="none" />
      <Text style={styles.label}>New time</Text>
      <TextInput accessibilityLabel="Proposed check-in time" placeholder="HH:mm (24-hour time)" value={time} onChangeText={setTime} style={styles.input} autoCapitalize="none" />
      <Text style={styles.body}>Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</Text>
      <Text style={styles.label}>Duration</Text>
      <View style={styles.row} accessibilityRole="radiogroup">{([15, 30] as const).map(minutes => <Pressable key={minutes}
        accessibilityRole="radio" accessibilityState={{ checked: duration === minutes }} onPress={() => setDuration(minutes)}
        style={[styles.choice, duration === minutes && styles.selected]}><Text style={styles.label}>{minutes} minutes</Text></Pressable>)}</View>
      <AppButton label="Review new time" onPress={() => { const problem = validate(); setError(problem); if (!problem) setReview(true); }} />
    </>}
    <AppButton label="Back to Your Circle" variant="secondary" disabled={busy} onPress={() => router.back()} />
  </Screen>;
}

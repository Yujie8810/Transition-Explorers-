import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../components/Screen';
import { AppButton } from '../../components/AppButton';
import { usePeople } from '../people/PeopleProvider';
import { CheckIn } from '../../types';
import { useNetwork } from './NetworkProvider';
import { styles } from './styles';

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const timeKey = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.choice, selected && styles.selected]}>
    <Text style={styles.label}>{label}</Text>
  </Pressable>;
}

export default function CheckInScreen() {
  const { ready: peopleReady, loadError: peopleError, reload: reloadPeople } = usePeople();
  const network = useNetwork();
  const params = useLocalSearchParams<{ guideId?: string | string[]; checkInId?: string | string[] }>();
  if (!network.ready) return <Screen title="Plan a check-in">
    <Text style={styles.body}>{network.loadError || 'Loading your circle…'}</Text>
    {network.loadError ? <AppButton label="Retry" onPress={network.reload} /> : null}
  </Screen>;
  if (!peopleReady && network.contactIds.some(id => id.includes('-'))) return <Screen title="Plan a check-in">
    <Text style={styles.body}>{peopleError || 'Loading your contacts…'}</Text>
    {peopleError ? <AppButton label="Retry profiles" onPress={reloadPeople} /> : null}
  </Screen>;
  const id = first(params.checkInId);
  const existing = network.checkIns.find((item) => item.id === id);
  if (id && (!existing || existing.status === 'cancelled')) return <Screen title="Check-in unavailable"><Text style={styles.body}>This check-in no longer exists.</Text><AppButton label="Your Circle" onPress={() => router.replace('/network')} /></Screen>;
  return <CheckInForm key={id ?? first(params.guideId) ?? 'new'} existing={existing} initialGuideId={first(params.guideId)} />;
}

function CheckInForm({ existing, initialGuideId }: { existing?: CheckIn; initialGuideId?: string }) {
  const network = useNetwork();
  const { guides } = usePeople();
  const contacts = guides.filter((guide) => network.contactIds.includes(guide.id));
  const [guideId, setGuideId] = useState(existing?.guideId ?? initialGuideId ?? contacts[0]?.id ?? '');
  const [topic, setTopic] = useState(existing?.topic ?? '');
  const [duration, setDuration] = useState<15 | 30>(existing?.durationMinutes ?? 15);
  const [date, setDate] = useState(existing ? dateKey(new Date(existing.startsAt)) : dateKey(new Date()));
  const [time, setTime] = useState(existing ? timeKey(new Date(existing.startsAt)) : '09:00');
  const [error, setError] = useState('');
  const [review, setReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<CheckIn | null>(null);
  const guide = contacts.find((contact) => contact.id === guideId);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(); day.setDate(day.getDate() + index); return day;
  });
  const startsAt = new Date(`${date}T${time}:00`);
  const validate = () => {
    if (!guide) return 'Select a contact from your circle.';
    if (!topic.trim()) return 'Enter a topic for your check-in.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
      || !Number.isFinite(startsAt.getTime()) || dateKey(startsAt) !== date || timeKey(startsAt) !== time) return 'Enter a valid date (YYYY-MM-DD) and time (HH:mm).';
    if (startsAt.getTime() <= Date.now()) return 'Choose a future date and time.';
    return '';
  };
  const save = async () => {
    const problem = validate();
    if (problem) { setError(problem); setReview(false); return; }
    setSaving(true); setError('');
    try {
      const result = await network.saveCheckIn({ guideId, topic, durationMinutes: duration, startsAt: startsAt.toISOString() }, existing?.id);
      setSaved(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save. Please try again.'); }
    finally { setSaving(false); }
  };
  if (saved) return <Screen title={saved.delivered && saved.status === 'pending' ? 'Invitation sent' : 'Check-in saved'}
    subtitle={saved.delivered ? saved.status === 'pending'
      ? 'The graduate can accept or decline. Their decision will appear in Your Circle.'
      : `Invitation status: ${saved.status}. Find your check-in in Your Circle.`
      : 'Find your personal plan in Your Circle.'}>
    <View style={styles.card}><Text style={styles.title}>{saved.topic}</Text><Text style={styles.body}>{guides.find(contact => contact.id === saved.guideId)?.name ?? 'Your contact'}</Text>
      <Text style={styles.body}>{new Date(saved.startsAt).toLocaleString()} · {saved.durationMinutes} minutes</Text></View>
    <AppButton label="View Your Circle" onPress={() => router.replace('/network')} />
  </Screen>;
  if (!contacts.length) return <Screen title="Plan a check-in"><Text style={styles.body}>Add a graduate to your circle before scheduling a check-in.</Text><AppButton label="Find people" onPress={() => router.push('/people')} /></Screen>;
  return <Screen title={review ? 'Review your check-in' : existing ? 'Edit check-in' : 'Plan a check-in'} subtitle="Make time to connect. Choose a topic and a time that works for you.">
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {review ? <>
      <View style={styles.card}><Text style={styles.title}>{topic.trim()}</Text><Text style={styles.label}>{guide?.name}</Text>
        <Text style={styles.body}>{startsAt.toLocaleString()} · {duration} minutes</Text>
        <Text style={styles.body}>Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</Text></View>
      {guide?.listed !== undefined ? <Text style={styles.body}>This time will be sent as an invitation. Editing a sent invitation asks the graduate to accept the new details.</Text> : null}
      <AppButton label={saving ? 'Saving…' : guide?.listed !== undefined ? 'Confirm and send invitation' : 'Confirm and save'} disabled={saving} onPress={() => void save()} />
      <AppButton variant="secondary" label="Edit details" disabled={saving} onPress={() => { setReview(false); setError(''); }} />
    </> : <>
      <Text style={styles.label}>Contact</Text>
      {existing ? <View style={styles.card}>
        <Text style={styles.label}>{guide?.name ?? 'Unavailable contact'}</Text>
        <Text style={styles.body}>To choose a different contact, create a new check-in.</Text>
      </View> : <View style={styles.row}>{contacts.map((contact) => <Choice key={contact.id} label={contact.name} selected={guideId === contact.id} onPress={() => setGuideId(contact.id)} />)}</View>}
      <Text style={styles.label}>Topic</Text>
      <TextInput style={styles.input} value={topic} onChangeText={setTopic} placeholder="What would you like to talk about?" accessibilityLabel="Check-in topic" maxLength={200} />
      <Text style={styles.label}>Duration</Text>
      <View style={styles.row}>{([15, 30] as const).map((minutes) => <Choice key={minutes} label={`${minutes} minutes`} selected={duration === minutes} onPress={() => setDuration(minutes)} />)}</View>
      <Text style={styles.label}>Date</Text>
      <View style={styles.row}>{days.map((day) => <Choice key={dateKey(day)} label={day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} selected={date === dateKey(day)} onPress={() => setDate(dateKey(day))} />)}</View>
      <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" accessibilityLabel="Check-in date, YYYY-MM-DD" autoCapitalize="none" />
      <Text style={styles.label}>Time</Text>
      <Text style={styles.body}>Suggested times, not confirmed availability. Real contacts can accept or decline your invitation.</Text>
      <View style={styles.row}>{['09:00', '10:00', '12:00', '14:00', '16:00', '18:00'].map((slot) => <Choice key={slot} label={slot} selected={time === slot} onPress={() => setTime(slot)} />)}</View>
      <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="HH:mm (24-hour time)" accessibilityLabel="Check-in time, HH:mm in 24-hour time" autoCapitalize="none" />
      <Text style={styles.body}>Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</Text>
      <AppButton label="Review check-in" onPress={() => { const problem = validate(); setError(problem); if (!problem) setReview(true); }} />
    </>}
    <AppButton variant="secondary" label="Back to Your Circle" disabled={saving} onPress={() => router.replace('/network')} />
  </Screen>;
}

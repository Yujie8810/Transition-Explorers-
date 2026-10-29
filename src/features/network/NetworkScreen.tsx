import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { AppButton } from '../../components/AppButton';
import { sampleGuides } from '../../data/sampleData';
import { useNetwork } from './NetworkProvider';
import { styles } from './styles';

export default function NetworkScreen() {
  const network = useNetwork();
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); setConfirmation(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save changes. Please try again.'); }
    finally { setBusy(false); }
  };
  const name = (id: string) => sampleGuides.find((guide) => guide.id === id)?.name ?? 'Unavailable graduate';
  const contacts = sampleGuides.filter((guide) => network.contactIds.includes(guide.id));
  const filtered = contacts.filter((guide) => `${guide.name} ${guide.role} ${guide.expertise.join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()));
  const sorted = [...network.checkIns].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const upcoming = sorted.filter((item) => Date.parse(item.startsAt) + item.durationMinutes * 60000 > Date.now());
  const past = sorted.filter((item) => Date.parse(item.startsAt) + item.durationMinutes * 60000 <= Date.now());
  if (!network.ready) return <Screen title="Your Circle">
    <Text style={network.loadError ? styles.error : styles.body}>{network.loadError || 'Loading your circle…'}</Text>
    {network.loadError ? <AppButton label="Retry" onPress={network.reload} /> : null}
  </Screen>;
  return <Screen title="Your Circle" subtitle="Manage contacts, track requests, and make time to connect.">
    <Text style={styles.body}>{contacts.length} contacts · {network.requests.length} saved requests · {upcoming.length} upcoming check-ins</Text>
    <AppButton label="Find people" onPress={() => router.push('/people')} />
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Text style={styles.title}>Contacts</Text>
    <TextInput style={styles.input} value={search} onChangeText={setSearch} placeholder="Search your contacts" accessibilityLabel="Search your contacts" />
    {!filtered.length ? <Text style={styles.body}>{contacts.length ? 'No contacts match your search.' : 'Add a graduate from People or save a guidance request to start your circle.'}</Text> : null}
    {filtered.map((guide) => <View key={guide.id} style={styles.card}>
      <Text style={styles.title}>{guide.name}</Text><Text style={styles.body}>{guide.role}</Text>
      <Text style={styles.body}>{guide.expertise.join(' · ')}</Text>
      <AppButton label="View profile" onPress={() => router.push({ pathname: '/people/[id]', params: { id: guide.id } })} />
      <AppButton label="Schedule check-in" onPress={() => router.push({ pathname: '/network/check-in', params: { guideId: guide.id } })} />
      {confirmation === guide.id ? <>
        <Text style={styles.body}>Remove {guide.name}? Saved requests and history will remain.</Text>
        <AppButton label="Confirm removal" disabled={busy} onPress={() => void run(() => network.removeContact(guide.id))} />
        <AppButton label="Keep contact" disabled={busy} onPress={() => setConfirmation('')} />
      </> : <AppButton label="Remove contact" disabled={busy} onPress={() => setConfirmation(guide.id)} />}
    </View>)}
    <Text style={styles.title}>Upcoming check-ins</Text>
    <Text style={styles.body}>Times use your device's local time zone. Confirm availability with your contact separately.</Text>
    {!upcoming.length ? <Text style={styles.body}>No check-ins planned yet. Choose a contact to schedule one.</Text> : null}
    {upcoming.map((item) => <View key={item.id} style={styles.card}>
      <Text style={styles.title}>{item.topic}</Text>
      <Text style={styles.body}>{name(item.guideId)} · {item.durationMinutes} minutes</Text>
      <Text style={styles.label}>{new Date(item.startsAt).toLocaleString()}</Text>
      <AppButton label="Reschedule or edit" onPress={() => router.push({ pathname: '/network/check-in', params: { checkInId: item.id } })} />
      {confirmation === item.id ? <>
        <Text style={styles.body}>Cancel this check-in?</Text>
        <AppButton label="Confirm cancellation" disabled={busy} onPress={() => void run(() => network.cancelCheckIn(item.id))} />
        <AppButton label="Keep check-in" disabled={busy} onPress={() => setConfirmation('')} />
      </> : <AppButton label="Cancel check-in" disabled={busy} onPress={() => setConfirmation(item.id)} />}
    </View>)}
    <Text style={styles.title}>Saved guidance requests</Text>
    <Text style={styles.body}>Requests are saved on this device. Messaging graduates is not connected yet.</Text>
    {!network.requests.length ? <Text style={styles.body}>Your requests from People will appear here.</Text> : null}
    {[...network.requests].reverse().map((request) => <View key={request.id} style={styles.card}>
      <Text style={styles.label}>{name(request.guideId)} · {request.kind === 'advice' ? 'Advice' : 'Check-in'}</Text>
      <Text style={styles.body}>{request.message}</Text>
      {network.contactIds.includes(request.guideId) && request.kind === 'check-in' ? <AppButton label="Plan this check-in" onPress={() => router.push({ pathname: '/network/check-in', params: { guideId: request.guideId } })} /> : null}
      <AppButton label="Dismiss request" disabled={busy} onPress={() => void run(() => network.dismissRequest(request.id))} />
    </View>)}
    {past.length ? <><Text style={styles.title}>Check-in history</Text>
      {[...past].reverse().map((item) => <View key={item.id} style={styles.card}>
        <Text style={styles.label}>{item.topic}</Text>
        <Text style={styles.body}>{name(item.guideId)} · {new Date(item.startsAt).toLocaleString()} · {item.durationMinutes} minutes</Text>
      </View>)}
    </> : null}
  </Screen>;
}

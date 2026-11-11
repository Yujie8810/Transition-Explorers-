import type { CheckIn } from '../../types';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { AppButton } from '../../components/AppButton';
import { usePeople } from '../people/PeopleProvider';
import { useNetwork } from './NetworkProvider';
import { TimeProposalCard } from './TimeProposalCard';
import { RequestsPanel } from './RequestsPanel';
import { useCircleSync } from './useCircleSync';
import { styles } from './styles';

export default function NetworkScreen() {
  const { guides, loadError: peopleError, reload: reloadPeople, ready: peopleReady } = usePeople();
  const network = useNetwork();
  const { syncError, refresh } = useCircleSync();
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
  const name = (id: string) => guides.find((guide) => guide.id === id)?.name ?? 'Unavailable graduate';
  const contacts = network.contactIds.map(id => guides.find(guide => guide.id === id)
    ?? { id, name: peopleReady ? 'Unavailable graduate' : 'Loading contact…', role: '', expertise: [] });
  const filtered = contacts.filter((guide) => `${guide.name} ${guide.role} ${guide.expertise.join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()));
  const owned = new Set(network.checkIns.map(item => item.id));
  const hasPendingProposal = (item: CheckIn) => network.timeProposals.some(proposal => proposal.checkInId === item.id && proposal.status === 'pending' && proposal.baseRevision === item.revision);
  const propose = (item: CheckIn) => router.push({ pathname: '/network/propose-time', params: { id: item.id } });
  const person = (item: CheckIn) => name(owned.has(item.id) ? item.guideId : item.senderId ?? '');
  const sorted = [...network.checkIns, ...network.incomingCheckIns.filter(item => item.status === 'accepted')].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const active = sorted.filter(item => !['declined', 'cancelled'].includes(item.status ?? ''));
  const upcoming = active.filter((item) => Date.parse(item.startsAt) + item.durationMinutes * 60000 > Date.now());
  const past = active.filter((item) => Date.parse(item.startsAt) + item.durationMinutes * 60000 <= Date.now());
  if (!network.ready) return <Screen title="Your Circle">
    <Text style={network.loadError ? styles.error : styles.body}>{network.loadError || 'Loading your circle…'}</Text>
    {network.loadError ? <AppButton label="Retry" onPress={network.reload} /> : null}
  </Screen>;
  return <Screen title="Your Circle" subtitle="Manage contacts, track requests, and make time to connect.">
    {!peopleReady && !peopleError ? <Text style={styles.body}>Loading community profiles…</Text> : null}
    {peopleError ? <><Text style={styles.error}>{peopleError}</Text><AppButton label="Retry profiles" onPress={reloadPeople} /></> : null}
    <Text style={styles.body}>{contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'} · {network.requests.length} {network.requests.length === 1 ? 'request' : 'requests'} · {upcoming.length} upcoming {upcoming.length === 1 ? 'check-in' : 'check-ins'}</Text>
    <AppButton label="Find people" onPress={() => router.push('/people')} />
    <AppButton variant="secondary" label="Refresh Circle" onPress={() => void run(refresh)} />
    {syncError ? <Text accessibilityRole="alert" style={styles.error}>{syncError}</Text> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <RequestsPanel name={name} busy={busy} run={run} />
    <Text style={styles.title}>Check-in invitations received</Text>
    {!network.incomingCheckIns.length ? <Text style={styles.body}>Scheduled invitations will appear here.</Text> : null}
    {network.incomingCheckIns.map(item => <View key={item.id} style={styles.card}>
      <Text style={styles.title}>{item.topic}</Text>
      <Text style={styles.label}>From {name(item.senderId ?? '')}</Text>
      <Text style={styles.body}>{new Date(item.startsAt).toLocaleString()} · {item.durationMinutes} minutes</Text>
      <Text style={styles.body}>Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</Text>
      <Text style={styles.label}>{item.status === 'pending' ? hasPendingProposal(item) ? 'Awaiting the sender’s response to your new time' : Date.parse(item.startsAt) <= Date.now() ? 'Expired · ask for a new time' : 'Awaiting your response' : item.status === 'accepted' ? 'Accepted' : item.status === 'declined' ? 'Declined' : 'Cancelled'}</Text>
      <TimeProposalCard meeting={item} owner={false} busy={busy} run={run} />
      {item.status === 'pending' && !hasPendingProposal(item) && Date.parse(item.startsAt) > Date.now() ? <>
        <AppButton label="Accept invitation" disabled={busy} onPress={() => void run(() => network.respondToCheckIn(item.id, 'accepted', item.revision ?? 1))} />
        <AppButton label="Decline invitation" variant="secondary" disabled={busy} onPress={() => void run(() => network.respondToCheckIn(item.id, 'declined', item.revision ?? 1))} />
      </> : null}
      {item.status !== 'cancelled' && Date.parse(item.startsAt) + item.durationMinutes * 60000 > Date.now() && !hasPendingProposal(item) ?
        <AppButton label="Reschedule and propose a new time" variant="secondary" disabled={busy} onPress={() => propose(item)} /> : null}
    </View>)}
    {sorted.some(item => ['declined', 'cancelled'].includes(item.status ?? '')) ? <Text style={styles.title}>Declined and cancelled check-ins</Text> : null}
    {sorted.filter(item => ['declined', 'cancelled'].includes(item.status ?? '')).map(item => <View key={item.id} style={styles.card}>
      <Text style={styles.label}>{item.topic} · {name(item.guideId)}</Text>
      <Text style={styles.body}>{new Date(item.startsAt).toLocaleString()} · {item.status}</Text>
      <TimeProposalCard meeting={item} owner={true} busy={busy} run={run} />
    </View>)}
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
    <Text style={styles.body}>Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}.</Text>
    {!upcoming.length ? <Text style={styles.body}>No check-ins planned yet. Choose a contact to schedule one.</Text> : null}
    {upcoming.map((item) => <View key={item.id} style={styles.card}>
      <Text style={styles.title}>{item.topic}</Text>
      <Text style={styles.body}>{person(item)} · {item.durationMinutes} minutes</Text>
      <Text style={styles.label}>{new Date(item.startsAt).toLocaleString()}</Text>
      <Text style={styles.label}>{item.delivered ? hasPendingProposal(item) ? 'New time proposal awaiting your response' : item.status === 'pending' ? 'Awaiting acceptance' : 'Accepted' : 'Personal plan'}</Text>
      {owned.has(item.id) ? <>
      <TimeProposalCard meeting={item} owner busy={busy} run={run} />
      <AppButton label="Reschedule or edit" onPress={() => router.push({ pathname: '/network/check-in', params: { checkInId: item.id } })} />
      {confirmation === item.id ? <>
        <Text style={styles.body}>Cancel this check-in?</Text>
        <AppButton label="Confirm cancellation" disabled={busy} onPress={() => void run(() => network.cancelCheckIn(item.id))} />
        <AppButton label="Keep check-in" disabled={busy} onPress={() => setConfirmation('')} />
      </> : <AppButton label="Cancel check-in" disabled={busy} onPress={() => setConfirmation(item.id)} />}
      </> : <AppButton label="Reschedule and propose a new time" variant="secondary" disabled={busy || hasPendingProposal(item)} onPress={() => propose(item)} />}
    </View>)}
    {past.length ? <><Text style={styles.title}>Check-in history</Text>
      {[...past].reverse().map((item) => <View key={item.id} style={styles.card}>
        <Text style={styles.label}>{item.topic}</Text>
        <Text style={styles.body}>{person(item)} · {new Date(item.startsAt).toLocaleString()} · {item.durationMinutes} minutes</Text>
      </View>)}
    </> : null}
  </Screen>;
}

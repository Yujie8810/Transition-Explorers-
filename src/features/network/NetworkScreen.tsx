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

type CircleSection = 'received' | 'sent' | 'check-ins' | 'contacts';

export default function NetworkScreen({ section = null }: { section?: CircleSection | null } = {}) {
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
  const now = Date.now();
  const upcoming = active.filter((item) => Date.parse(item.startsAt) + item.durationMinutes * 60000 > now);
  const past = active.filter((item) => Date.parse(item.startsAt) + item.durationMinutes * 60000 <= now);
  const invitationGroups = [
    { title: 'Upcoming', empty: 'No upcoming invitations awaiting your response.', items: network.incomingCheckIns.filter(item => item.status === 'pending' && Date.parse(item.startsAt) > now) },
    { title: 'Accepted', empty: 'No accepted invitations yet.', items: network.incomingCheckIns.filter(item => item.status === 'accepted') },
    { title: 'Declined', empty: 'No declined invitations.', items: network.incomingCheckIns.filter(item => item.status === 'declined') },
    { title: 'Expired', items: network.incomingCheckIns.filter(item => item.status === 'pending' && Date.parse(item.startsAt) <= now) },
    { title: 'Cancelled', items: network.incomingCheckIns.filter(item => item.status === 'cancelled') },
  ];
  const sections = [
    { id: 'received', href: '/network/requests-received', label: 'Requests received', count: network.inbox.length },
    { id: 'sent', href: '/network/guidance-requests', label: 'Your guidance requests', count: network.requests.length },
    { id: 'check-ins', href: '/network/check-ins', label: 'Check-ins', count: network.checkIns.length + network.incomingCheckIns.length },
    { id: 'contacts', href: '/network/contacts', label: 'Contacts', count: contacts.length },
  ] as const;
  const title = sections.find(item => item.id === section)?.label ?? 'Your Circle';
  if (!network.ready) return <Screen title={title}>
    <Text style={network.loadError ? styles.error : styles.body}>{network.loadError || 'Loading your circle…'}</Text>
    {network.loadError ? <AppButton label="Retry" onPress={network.reload} /> : null}
  </Screen>;
  return <Screen title={title} subtitle={section ? undefined : "Manage contacts, track requests, and make time to connect."}>
    {!peopleReady && !peopleError ? <Text style={styles.body}>Loading community profiles…</Text> : null}
    {peopleError ? <><Text style={styles.error}>{peopleError}</Text><AppButton label="Retry profiles" onPress={reloadPeople} /></> : null}
    {!section ? <>
      <Text style={styles.body}>{contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'} · {network.requests.length} {network.requests.length === 1 ? 'request' : 'requests'} · {upcoming.length} upcoming {upcoming.length === 1 ? 'check-in' : 'check-ins'}</Text>
      <AppButton label="Find people" onPress={() => router.push('/people')} />
    </> : <AppButton variant="secondary" label="Back to Your Circle" onPress={() => router.navigate('/network')} />}
    <AppButton variant="secondary" label="Refresh Circle" onPress={() => void run(refresh)} />
    {syncError ? <Text accessibilityRole="alert" style={styles.error}>{syncError}</Text> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {!section ? <>
      <Text style={styles.body}>Choose a section to view your circle.</Text>
      {sections.map(item => <AppButton key={item.id} label={`${item.label} (${item.count})`}
        variant="secondary" onPress={() => router.push(item.href)} />)}
    </> : null}
    {section === 'received' || section === 'sent' ? <RequestsPanel section={section} name={name} busy={busy} run={run} /> : null}
    {section === 'check-ins' ? <>
      <Text style={styles.title}>Check-in invitations received</Text>
      {invitationGroups.filter(group => group.items.length || 'empty' in group).map(group => <View key={group.title} style={{ gap: 16 }}>
        <Text accessibilityRole="header" style={styles.label}>{group.title} ({group.items.length})</Text>
        {!group.items.length && 'empty' in group ? <Text style={styles.body}>{group.empty}</Text> : null}
        {[...group.items].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)).map(item => <View key={item.id} style={styles.card}>
          <Text style={styles.title}>{item.topic}</Text>
          <Text style={styles.label}>From {name(item.senderId ?? '')}</Text>
          <Text style={styles.body}>{new Date(item.startsAt).toLocaleString()} · {item.durationMinutes} minutes</Text>
          <Text style={styles.body}>Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</Text>
          <Text style={styles.label}>{item.status === 'pending' ? hasPendingProposal(item) ? 'Awaiting the sender’s response to your new time' : Date.parse(item.startsAt) <= now ? 'Expired · ask for a new time' : 'Awaiting your response' : item.status === 'accepted' ? 'Accepted' : item.status === 'declined' ? 'Declined' : 'Cancelled'}</Text>
          <TimeProposalCard meeting={item} owner={false} busy={busy} run={run} />
          {item.status === 'pending' && !hasPendingProposal(item) && Date.parse(item.startsAt) > now ? <>
            <AppButton label="Accept invitation" disabled={busy} onPress={() => void run(() => network.respondToCheckIn(item.id, 'accepted', item.revision ?? 1))} />
            <AppButton label="Decline invitation" variant="danger" disabled={busy} onPress={() => void run(() => network.respondToCheckIn(item.id, 'declined', item.revision ?? 1))} />
          </> : null}
          {item.status !== 'cancelled' && Date.parse(item.startsAt) + item.durationMinutes * 60000 > now && !hasPendingProposal(item) ?
            <AppButton label="Reschedule" variant="secondary" disabled={busy} onPress={() => propose(item)} /> : null}
        </View>)}
      </View>)}
      {sorted.some(item => ['declined', 'cancelled'].includes(item.status ?? '')) ? <Text style={styles.title}>Declined and cancelled check-ins</Text> : null}
      {sorted.filter(item => ['declined', 'cancelled'].includes(item.status ?? '')).map(item => <View key={item.id} style={styles.card}>
        <Text style={styles.label}>{item.topic} · {name(item.guideId)}</Text>
        <Text style={styles.body}>{new Date(item.startsAt).toLocaleString()} · {item.status}</Text>
        <TimeProposalCard meeting={item} owner={true} busy={busy} run={run} />
      </View>)}
      <Text style={styles.title}>Your scheduled check-ins</Text>
      <Text style={styles.body}>Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}.</Text>
      {!upcoming.some(item => owned.has(item.id)) ? <Text style={styles.body}>No check-ins planned yet. Choose a contact to schedule one.</Text> : null}
      {upcoming.filter(item => owned.has(item.id)).map((item) => <View key={item.id} style={styles.card}>
        <Text style={styles.title}>{item.topic}</Text>
        <Text style={styles.body}>{person(item)} · {item.durationMinutes} minutes</Text>
        <Text style={styles.label}>{new Date(item.startsAt).toLocaleString()}</Text>
        <Text style={styles.label}>{item.delivered ? hasPendingProposal(item) ? 'New time proposal awaiting your response' : item.status === 'pending' ? 'Awaiting acceptance' : 'Accepted' : 'Personal plan'}</Text>
        <TimeProposalCard meeting={item} owner busy={busy} run={run} />
        <AppButton label="Reschedule or edit" onPress={() => router.push({ pathname: '/network/check-in', params: { checkInId: item.id } })} />
        {confirmation === item.id ? <>
          <Text style={styles.body}>Cancel this check-in?</Text>
          <AppButton label="Confirm cancellation" variant="danger" disabled={busy} onPress={() => void run(() => network.cancelCheckIn(item.id))} />
          <AppButton label="Keep check-in" disabled={busy} onPress={() => setConfirmation('')} />
        </> : <AppButton label="Cancel check-in" variant="danger" disabled={busy} onPress={() => setConfirmation(item.id)} />}
      </View>)}
      {past.length ? <><Text style={styles.title}>Check-in history</Text>
        {[...past].reverse().map((item) => <View key={item.id} style={styles.card}>
          <Text style={styles.label}>{item.topic}</Text>
          <Text style={styles.body}>{person(item)} · {new Date(item.startsAt).toLocaleString()} · {item.durationMinutes} minutes</Text>
        </View>)}
      </> : null}
    </> : null}
    {section === 'contacts' ? <>
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
          <AppButton label="Confirm removal" variant="danger" disabled={busy} onPress={() => void run(() => network.removeContact(guide.id))} />
          <AppButton label="Keep contact" disabled={busy} onPress={() => setConfirmation('')} />
        </> : <AppButton label="Remove contact" variant="danger" disabled={busy} onPress={() => setConfirmation(guide.id)} />}
      </View>)}
    </> : null}
  </Screen>;
}

import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '../../components/AppButton';
import { useNetwork } from './NetworkProvider';
import { styles } from './styles';

export function RequestsPanel({ section, name, busy, run }: {
  section: 'received' | 'sent'; name: (id: string) => string; busy: boolean; run: (action: () => Promise<void>) => Promise<void>;
}) {
  const network = useNetwork();
  const openChat = (id: string) => router.push({ pathname: '/network/chat/[id]', params: { id } });
  return <>
    {section === 'received' ? <>
      <Text style={styles.title}>Requests received</Text>
      {!network.inbox.length ? <Text style={styles.body}>Requests from other people will appear here.</Text> : null}
      {[...network.inbox].reverse().map(request => <View key={request.id} style={styles.card}>
        <Text style={styles.label}>{name(request.senderId ?? '')} · {request.kind === 'advice' ? 'Guidance chat' : 'Check-in request'}</Text>
        <Text style={styles.body}>{request.message}</Text>
        <Text style={styles.label}>{request.status === 'answered' ? 'Conversation started' : request.status === 'pending' ? 'Awaiting your response' : request.status}</Text>
        {request.kind === 'advice' ? <AppButton label="Open chat" onPress={() => openChat(request.id)} /> : request.status === 'pending' ? <>
          <AppButton label="Accept check-in request" disabled={busy} onPress={() => void run(() => network.respondToRequest(request.id, 'accepted', ''))} />
          <AppButton label="Decline check-in request" variant="danger" disabled={busy} onPress={() => void run(() => network.respondToRequest(request.id, 'declined', ''))} />
          <Text style={styles.body}>This request has no scheduled time yet.</Text>
        </> : null}
      </View>)}
    </> : <>
      <Text style={styles.title}>Your guidance requests</Text>
      {!network.requests.length ? <Text style={styles.body}>Your requests from People will appear here.</Text> : null}
      {[...network.requests].reverse().map(request => <View key={request.id} style={styles.card}>
        <Text style={styles.label}>{name(request.guideId)} · {request.kind === 'advice' ? 'Guidance' : 'Check-in request'}</Text>
        <Text style={styles.body}>{request.message}</Text>
        <Text style={styles.label}>{request.delivered
          ? request.status === 'pending' ? 'Awaiting response' : request.status === 'answered' ? 'Reply received' : request.status
          : 'Personal record · not delivered'}</Text>
        {request.kind === 'advice' && request.delivered ? <AppButton label="Open chat" onPress={() => openChat(request.id)} /> : null}
        {network.contactIds.includes(request.guideId) && request.kind === 'check-in' && (!request.delivered || request.status === 'accepted')
          ? <AppButton label="Propose a check-in time" onPress={() => router.push({ pathname: '/network/check-in', params: { guideId: request.guideId } })} /> : null}
        <AppButton label={request.delivered ? 'Hide request' : 'Dismiss request'} variant="secondary" disabled={busy}
          onPress={() => void run(() => network.dismissRequest(request.id))} />
      </View>)}
    </>}
  </>;
}

import { Text } from '../../components/Typography';
import { View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import type { CheckIn } from '../../types';
import { useNetwork } from './NetworkProvider';
import { styles } from './styles';

export function TimeProposalCard({ meeting, owner, busy, run }: {
  meeting: CheckIn; owner: boolean; busy: boolean; run: (action: () => Promise<void>) => Promise<void>;
}) {
  const network = useNetwork();
  const proposal = network.timeProposals.filter(item => item.checkInId === meeting.id).slice(-1)[0];
  if (!proposal) return null;
  const pending = proposal.status === 'pending' && proposal.baseRevision === meeting.revision && meeting.status !== 'cancelled';
  const current = pending || proposal.baseRevision === (meeting.revision ?? 1) - (proposal.status === 'accepted' ? 1 : 0);
  return <View style={styles.card}>
    <Text style={styles.label}>{!current ? 'Previous time proposal' : pending ? owner ? 'New time proposed' : 'Your proposed time · awaiting sender' : proposal.status === 'accepted' ? 'New time accepted' : proposal.status === 'rejected' ? 'New time rejected · original time unchanged' : 'This proposal is no longer current'}</Text>
    <Text style={styles.body}>{new Date(proposal.startsAt).toLocaleString()} · {proposal.durationMinutes} minutes</Text>
    <Text style={styles.body}>Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</Text>
    {pending && owner ? <>
      <AppButton label="Accept new time" disabled={busy} onPress={() => void run(() => network.respondToTimeProposal(proposal.id, 'accepted'))} />
      <AppButton label="Reject new time" variant="secondary" disabled={busy} onPress={() => void run(() => network.respondToTimeProposal(proposal.id, 'rejected'))} />
    </> : null}
  </View>;
}

import { Text, TextInput } from '../../components/Typography';
import { useState } from 'react';
import { Switch, View, StyleSheet } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { useAuth } from '../auth/AuthProvider';
import { useProfile } from '../../state/ProfileContext';
import { usePeople } from './PeopleProvider';
import { theme } from '../../theme';
import type { Guide } from '../../types';

export function PeopleProfileEditor() {
  const { account } = useAuth();
  const { profile } = useProfile();
  const { guides, ready, loadError, reload, save } = usePeople();
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const own = guides.find(guide => guide.id === account?.id);
  return <View style={styles.card}>
    <Text style={styles.heading}>Your People profile</Text>
    <Text style={styles.text}>Choose to appear in People so signed-in community members can find you. Your name and program come from your profile.</Text>
    <Text style={styles.text}>{own?.listed ? 'You appear in People.' : 'You are not listed in People.'}</Text>
    {loadError ? <><Text accessibilityRole="alert">{loadError}</Text><AppButton label="Retry People profile" onPress={reload} /></> : null}
    {notice ? <Text accessibilityLiveRegion="polite">{notice}</Text> : null}
    {editing && ready ? <DirectoryForm key={own?.id ?? 'new'} guide={own} graduate={profile.affiliation === 'Graduate'}
      onCancel={() => setEditing(false)} onSave={async input => {
        await save(input); setEditing(false); setNotice(input.listed ? 'Your profile is now in People.' : 'Your People profile was updated.');
      }} /> : <AppButton label="Edit People profile" disabled={!ready} onPress={() => { setNotice(''); setEditing(true); }} />}
  </View>;
}
function DirectoryForm({ guide, graduate, onSave, onCancel }: {
  guide?: Guide; graduate: boolean;
  onSave: (input: { role: string; expertise: string[]; bio: string; listed: boolean }) => Promise<void>;
  onCancel: () => void;
}) {
  const [role, setRole] = useState(guide?.role ?? '');
  const [skills, setSkills] = useState(guide?.expertise.join(', ') ?? '');
  const [bio, setBio] = useState(guide?.bio ?? '');
  const [listed, setListed] = useState(guide?.listed ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (busy) return;
    if (listed && !graduate) { setError('Set your profile affiliation to Graduate before appearing in People.'); return; }
    setBusy(true); setError('');
    try { await onSave({ role, expertise: skills.split(','), bio, listed }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save. Please retry.'); }
    finally { setBusy(false); }
  };
  return <View style={styles.form}>
    {!graduate ? <Text style={styles.text}>To join the graduate directory, use Edit profile and select Graduate. This is self-reported.</Text> : null}
    <Text style={styles.text}>Role or job title</Text>
    <TextInput accessibilityLabel="People profile role" style={styles.input} value={role} onChangeText={setRole} maxLength={120} editable={!busy} placeholder="e.g. Software engineer" />
    <Text style={styles.text}>Expertise (separate skills with commas)</Text>
    <TextInput accessibilityLabel="People profile expertise" style={styles.input} value={skills} onChangeText={setSkills} maxLength={620} editable={!busy} placeholder="Code reviews, Technical interviews" />
    <Text style={styles.text}>About you</Text>
    <TextInput accessibilityLabel="People profile bio" style={styles.input} value={bio} onChangeText={setBio} maxLength={1000} editable={!busy} multiline />
    <Text style={styles.text}>Appear in People</Text>
    <Switch accessibilityLabel="Appear in People" value={listed} onValueChange={setListed} disabled={busy || (!graduate && !listed)} />
    <Text style={styles.text}>Other users can send you guidance chats and check-in invitations. Review them in Your Circle.</Text>
    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    <AppButton label={busy ? 'Saving…' : 'Save People profile'} disabled={busy} onPress={() => void submit()} />
    <AppButton variant="secondary" label="Cancel" disabled={busy} onPress={onCancel} />
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 20, gap: 12, backgroundColor: theme.colors.surface, borderRadius: 18 },
  form: { gap: 12 }, heading: { fontSize: 18, fontWeight: '700', color: theme.colors.ink },
  text: { fontSize: 16, color: theme.colors.ink },
  input: { padding: 14, minHeight: 48, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, color: theme.colors.ink },
});

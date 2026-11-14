import { Text, TextInput } from '../../components/Typography';
import { PeopleProfileEditor } from '../people/PeopleProfileEditor';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { AppButton } from '../../components/AppButton';
import { useProfile, UserProfile } from '../../state/ProfileContext';
import { useSavedAdvice } from '../../state/SavedAdviceContext';
import { useNetwork } from '../network/NetworkProvider';
import { theme } from '../../theme';
import { useAuth } from '../auth/AuthProvider';

/** Owner: Aalvee. Profile edits belong to the signed-in Supabase account. */
export default function ProfileScreen() {
  const { account, signOut, busy } = useAuth();
  const { profile, ready, loadError, reload, updateProfile } = useProfile();
  const { saved } = useSavedAdvice();
  const network = useNetwork();
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const logout = async () => {
    if (busy) return;
    setLogoutError('');
    try { await signOut(); }
    catch { setLogoutError('We could not log you out. Please try again.'); }
  };

  if (!ready) return <Screen title="Your profile">
    <Text style={styles.body}>{loadError || 'Loading your profile…'}</Text>
    {loadError ? <AppButton label="Retry loading profile" onPress={reload} /> : null}
    {logoutError ? <Text style={styles.error} accessibilityRole="alert">{logoutError}</Text> : null}
    <AppButton variant="secondary" label={busy ? 'Logging out…' : 'Log out'} disabled={busy} onPress={() => void logout()} />
  </Screen>;

  if (editing) return <ProfileForm profile={profile} onCancel={() => setEditing(false)}
    onSave={async next => {
      await updateProfile(next);
      setEditing(false);
      setNotice('Profile updated.');
    }} />;

  const initials = profile.name.split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();
  return <Screen title="Your profile" subtitle="Your place in the UTD community.">
    <View style={styles.card}>
      <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
        <Text style={styles.initials}>{initials}</Text>
      </View>
      <Text style={styles.name}>{profile.name}</Text>
      <Text style={styles.body}>{account?.email}</Text>
      <Text style={styles.body}>The University of Texas at Dallas</Text>
      <Text style={styles.badge}>UTD · {profile.affiliation}</Text>
      <Text style={styles.body}>{profile.program}</Text>
    </View>
    {notice ? <Text style={styles.notice} accessibilityLiveRegion="polite" role="status">{notice}</Text> : null}
    <AppButton label="Edit profile" onPress={() => { setNotice(''); setEditing(true); }} />
    <PeopleProfileEditor />
    <Text style={styles.heading}>Your support</Text>
    <AppButton variant="secondary" label="View your posted questions" onPress={() => router.push('/my-questions')} />
    <AppButton variant="secondary" label={`Saved advice (${saved.length})`} onPress={() => router.push('/saved')} />
    <AppButton variant="secondary" label={network.ready
      ? `Your Circle (${network.contactIds.length} ${network.contactIds.length === 1 ? 'contact' : 'contacts'})` : 'Your Circle'}
      onPress={() => router.push('/network')} />
    {logoutError ? <Text style={styles.error} accessibilityRole="alert">{logoutError}</Text> : null}
    <AppButton variant="secondary" label={busy ? 'Logging out…' : 'Log out'} disabled={busy} onPress={() => void logout()} />
  </Screen>;
}

// A separate form starts with the saved profile each time Edit is opened.
// Cancel discards only the draft; it never overwrites the saved profile.
function ProfileForm({ profile, onSave, onCancel }: {
  profile: UserProfile; onSave: (profile: UserProfile) => Promise<void>; onCancel: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [program, setProgram] = useState(profile.program);
  const [affiliation, setAffiliation] = useState(profile.affiliation);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (saving) return;
    if (!name.trim() || !program.trim()) { setError('Enter your name and program.'); return; }
    setSaving(true); setError('');
    try { await onSave({ name, program, affiliation }); }
    catch { setError('Your profile could not be saved. Your edits are still here. Please try again.'); }
    finally { setSaving(false); }
  };
  return <Screen title="Edit profile" subtitle="Changes are saved only when you tap Save profile.">
    <Text style={styles.label}>Name</Text>
    <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={80}
      accessibilityLabel="Profile name" autoCapitalize="words" editable={!saving} />
    <Text style={styles.label}>Program or field of study</Text>
    <TextInput style={styles.input} value={program} onChangeText={setProgram} maxLength={100}
      accessibilityLabel="Program or field of study" editable={!saving} />
    <Text style={styles.label}>UTD affiliation</Text>
    <View style={styles.choices} accessibilityRole="radiogroup">
      {(['Student', 'Graduate'] as const).map(value => <Pressable key={value}
        accessibilityRole="radio" accessibilityState={{ checked: affiliation === value, disabled: saving }}
        disabled={saving} onPress={() => setAffiliation(value)}
        style={[styles.choice, affiliation === value && styles.selected]}>
        <Text style={styles.label}>{value}</Text>
      </Pressable>)}
    </View>
    {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    <AppButton label={saving ? 'Saving…' : 'Save profile'} disabled={saving} onPress={() => void save()} />
    <AppButton variant="secondary" label="Cancel changes" disabled={saving} onPress={onCancel} />
  </Screen>;
}

const { colors } = theme;
const styles = StyleSheet.create({
  card: { padding: 24, borderRadius: 18, backgroundColor: colors.surface, gap: 12,
    borderWidth: 1, borderColor: colors.border },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.lime,
    alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 24, fontWeight: '800', color: colors.green },
  name: { fontSize: 26, fontWeight: '700', color: colors.ink },
  heading: { fontSize: 18, fontWeight: '700', color: colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink },
  badge: { alignSelf: 'flex-start', padding: 10, borderRadius: 12, backgroundColor: colors.lime,
    color: colors.green, fontSize: 15, fontWeight: '700' },
  notice: { fontSize: 16, lineHeight: 24, color: colors.green, fontWeight: '600' },
  label: { fontSize: 16, fontWeight: '600', color: colors.ink },
  input: { minHeight: 48, padding: 14, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, backgroundColor: colors.surface, fontSize: 16, color: colors.ink },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  choice: { minHeight: 48, padding: 14, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center' },
  selected: { backgroundColor: colors.lime, borderColor: colors.green },
  error: { fontSize: 16, color: '#B42318' },
});

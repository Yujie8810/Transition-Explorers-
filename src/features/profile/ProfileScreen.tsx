import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { AppButton } from '../../components/AppButton';
import { useProfile, UserProfile } from '../../state/ProfileContext';
import { useSavedAdvice } from '../../state/SavedAdviceContext';
import { useNetwork } from '../network/NetworkProvider';
import { theme } from '../../theme';

/** Owner: Aalvee. Profile edits are local and shared through ProfileProvider.
 * need to implment: Aproteem + Aalvee, replace the demo identity with the logged-in
 * user and add real simulated-session logout after the authentication module lands.
 */
export default function ProfileScreen() {
  const { profile, ready, loadError, reload, updateProfile } = useProfile();
  const { saved } = useSavedAdvice();
  const network = useNetwork();
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');

  if (!ready) return <Screen title="Your profile">
    <Text style={styles.body}>{loadError || 'Loading your profile…'}</Text>
    {loadError ? <AppButton label="Retry loading profile" onPress={reload} /> : null}
  </Screen>;

  if (editing) return <ProfileForm profile={profile} onCancel={() => setEditing(false)}
    onSave={async next => {
      await updateProfile(next);
      setEditing(false);
      setNotice('Profile saved on this device.');
    }} />;

  const initials = profile.name.split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();
  return <Screen title="Your profile" subtitle="Your place in the UTD community.">
    <View style={styles.card}>
      <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
        <Text style={styles.initials}>{initials}</Text>
      </View>
      <Text style={styles.name}>{profile.name}</Text>
      <Text style={styles.body}>The University of Texas at Dallas</Text>
      <Text style={styles.badge}>UTD · {profile.affiliation}</Text>
      <Text style={styles.body}>{profile.program}</Text>
    </View>
    {notice ? <Text style={styles.notice} accessibilityLiveRegion="polite" role="status">{notice}</Text> : null}
    <AppButton label="Edit profile" onPress={() => { setNotice(''); setEditing(true); }} />
    <Text style={styles.heading}>Your support</Text>
    <AppButton label="View your posted questions" onPress={() => router.push('/my-questions')} />
    <AppButton label={`Saved advice (${saved.length})`} onPress={() => router.dismissTo('/saved')} />
    <AppButton label={network.ready ? `Your Circle (${network.contactIds.length} contacts)` : 'Your Circle'}
      onPress={() => router.push('/network')} />
    <View style={styles.note}>
      <Text style={styles.heading}>Demo profile</Text>
      <Text style={styles.body}>This fictional profile is saved on this device. Login, signup, and UTD verification are still being developed.</Text>
    </View>
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
    <AppButton label="Cancel changes" disabled={saving} onPress={onCancel} />
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
  note: { padding: 20, borderRadius: 16, borderWidth: 1, borderColor: colors.border, gap: 8 },
  label: { fontSize: 16, fontWeight: '600', color: colors.ink },
  input: { minHeight: 48, padding: 14, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, backgroundColor: colors.surface, fontSize: 16, color: colors.ink },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  choice: { minHeight: 48, padding: 14, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center' },
  selected: { backgroundColor: colors.lime, borderColor: colors.green },
  error: { fontSize: 16, color: '#B42318' },
});

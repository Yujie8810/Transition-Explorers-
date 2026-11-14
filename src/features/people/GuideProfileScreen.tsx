import { Text } from '../../components/Typography';
import { useAuth } from '../auth/AuthProvider';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Screen } from '../../components/Screen';
import { AppButton } from '../../components/AppButton';
import { usePeople } from '../people/PeopleProvider';
import { theme } from '../../theme';
import { useNetwork } from '../network/NetworkProvider';

export default function GuideProfileScreen() {
  const { guides, loadError: peopleError, reload: reloadPeople, ready: peopleReady } = usePeople();
  const network = useNetwork();
  const { account } = useAuth();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const graduateId = Array.isArray(id) ? id[0] : id;
  const graduate = guides.find((guide) => guide.id === graduateId);

  if (!graduate && !peopleReady) return <Screen title="Community profile"><Text>{peopleError || 'Loading profile…'}</Text>{peopleError ? <AppButton label="Retry" onPress={reloadPeople} /> : null}</Screen>;

  if (!graduate) {
    return (
      <Screen title="Graduate profile">
        <Text style={styles.emptyMessage}>Graduate not found</Text>
        <AppButton label="Back to people" onPress={() => router.replace('/people')} />
      </Screen>
    );
  }

  return (
    <Screen title="Graduate profile">
      <View style={styles.profileCard}>
        <Text style={styles.name}>{graduate.name}</Text>
        <Text style={styles.role}>{graduate.role}</Text>
        <Text style={styles.expertise}>{graduate.expertise.join(' · ')}</Text>
      </View>

      <View style={styles.aboutSection}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.aboutText}>
          {graduate.bio || `${graduate.name} shares practical advice on starting a career and navigating workplace questions.`}
        </Text>
      </View>

      {graduate.id === account?.id ? <AppButton label="Edit your profile" onPress={() => router.push('/profile')} /> : <>
      {error ? <Text style={styles.emptyMessage}>{error}</Text> : null}
      {network.loadError ? <><Text style={styles.emptyMessage}>{network.loadError}</Text><AppButton label="Retry loading" onPress={network.reload} /></> : null}
      <AppButton
        label={network.contactIds.includes(graduate.id) ? 'View in Your Circle' : saving ? 'Saving…' : 'Add to Your Circle'}
        disabled={!network.ready || saving}
        onPress={() => {
          if (network.contactIds.includes(graduate.id)) { router.push('/network'); return; }
          setSaving(true); setError('');
          network.addContact(graduate.id).catch(() => setError('Could not save this contact. Please try again.')).finally(() => setSaving(false));
        }}
      />
      <AppButton
        variant="secondary"
        label="Ask for guidance"
        onPress={() =>
          router.push({
            pathname: '/people/request',
            params: { id: graduate.id },
          })
        }
      />
      </>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    padding: 16,
    gap: 10,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  role: {
    fontSize: 16,
    color: theme.colors.muted,
  },
  expertise: {
    fontSize: 14,
    color: theme.colors.ink,
  },
  aboutSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.ink,
  },
  aboutText: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.muted,
  },
  emptyMessage: {
    color: theme.colors.muted,
    fontSize: 15,
  },
});

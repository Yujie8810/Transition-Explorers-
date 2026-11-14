import { Text, TextInput } from '../../components/Typography';
import { useAuth } from '../auth/AuthProvider';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Screen } from '../../components/Screen';
import { AppButton } from '../../components/AppButton';
import { usePeople } from '../people/PeopleProvider';
import { theme } from '../../theme';
import { useNetwork } from '../network/NetworkProvider';

export default function HelpRequestScreen() {
  const { guides, loadError: peopleError, reload: reloadPeople, ready: peopleReady } = usePeople();
  const network = useNetwork();
  const { account } = useAuth();
  const [saving, setSaving] = useState(false);
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const graduateId = Array.isArray(id) ? id[0] : id;

  const graduate = guides.find((guide) => guide.id === graduateId);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  // Review preserves the editable draft; only confirmation writes to the network store.
  const [reviewing, setReviewing] = useState(false);
  const review = () => {
    if (!message.trim()) { setError('Please enter a message before reviewing.'); return; }
    if (message.trim().length > 2000) { setError('Keep your request within 2000 characters.'); return; }
    setError(''); setReviewing(true);
  };

  const handleSend = async () => {
    if (!graduate || saving) return;
    if (!message.trim()) {
      setError('Enter a message for your request.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      await network.saveRequest({ guideId: graduate.id, message, kind: 'advice' });
      setSent(true);
    } catch {
      setError('Your request could not be saved. Please try again.');
    } finally { setSaving(false); }
  };

  const scheduleCheckIn = async () => {
    if (!graduate || saving || !network.ready) return;
    setSaving(true); setError('');
    try {
      if (!network.contactIds.includes(graduate.id)) await network.addContact(graduate.id);
      router.push({ pathname: '/network/check-in', params: { guideId: graduate.id } });
    } catch {
      setError('Could not open check-in scheduling. Please try again.');
    } finally { setSaving(false); }
  };

  if (!graduate && !peopleReady) return <Screen title="Community profile"><Text>{peopleError || 'Loading profile…'}</Text>{peopleError ? <AppButton label="Retry" onPress={reloadPeople} /> : null}</Screen>;

  if (!graduate) {
    return (
      <Screen title="Request guidance">
        <Text style={styles.errorText}>
          Graduate not found. Please return to the People page and try again.
        </Text>
        <AppButton
          label="Back to people"
          onPress={() => router.replace('/people')}
        />
      </Screen>
    );
  }

  if (graduate.id === account?.id) return <Screen title="Your profile">
    <Text style={styles.bodyText}>You cannot request guidance from yourself.</Text>
    <AppButton label="Back to people" onPress={() => router.replace('/people')} />
  </Screen>;

  if (sent) {
    return (
      <Screen title="Request guidance">
        <View style={styles.card}>
          <Text style={styles.successTitle}>{graduate.listed !== undefined ? 'Request sent' : 'Request saved'}</Text>
          <Text style={styles.bodyText}>
            {graduate.listed !== undefined ? `Your request was sent to ${graduate.name}. Their response will appear in Your Circle.` : `Your demo request for ${graduate.name} is saved in Your Circle.`}
          </Text>

          <Text style={styles.sectionTitle}>Request type</Text>
          <Text style={styles.bodyText}>
            Advice
          </Text>

          <Text style={styles.sectionTitle}>Your message</Text>
          <Text style={styles.bodyText}>{message.trim()}</Text>
        </View>

        <AppButton label="View Your Circle" onPress={() => router.replace('/network')} />
        <AppButton
          variant="secondary" label="Back to profile"
          onPress={() =>
            router.replace({
              pathname: '/people/[id]',
              params: { id: graduate.id },
            })
          }
        />
      </Screen>
    );
  }

  if (reviewing) return <Screen title="Review your request" subtitle="Check the recipient and message before saving.">
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Requesting help from</Text>
      <Text style={styles.name}>{graduate.name}</Text>
      <Text style={styles.bodyText}>{graduate.role}</Text>
      <Text style={styles.sectionTitle}>Request type</Text>
      <Text style={styles.bodyText}>Advice</Text>
      <Text style={styles.sectionTitle}>Your message</Text>
      <Text style={styles.bodyText}>{message.trim()}</Text>
    </View>
    <Text style={styles.helperText}>{graduate.listed !== undefined ? 'Send this request to the graduate and track their response in Your Circle.' : 'This is a demo graduate. The request will be saved in Your Circle without delivery.'}</Text>
    {error ? <Text style={styles.errorText} accessibilityRole="alert">{error}</Text> : null}
    {network.loadError ? <><Text style={styles.errorText}>{network.loadError}</Text><AppButton label="Retry loading" onPress={network.reload} /></> : null}
    <AppButton label={saving ? 'Saving…' : graduate.listed !== undefined ? 'Confirm and send request' : 'Confirm and save request'} disabled={saving || !network.ready} onPress={() => void handleSend()} />
    <AppButton variant="secondary" label="Edit request" disabled={saving} onPress={() => { setReviewing(false); setError(''); }} />
  </Screen>;

  return (
    <Screen
      title="Request guidance"
      subtitle={`Save a guidance request for ${graduate.name}.`}
    >
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Requesting help from</Text>
        <Text style={styles.name}>{graduate.name}</Text>
        <Text style={styles.bodyText}>{graduate.role}</Text>
      </View>

      <Text style={styles.sectionTitle}>What kind of help do you need?</Text>

      <View style={styles.optionContainer} accessibilityRole="radiogroup">
        {(['advice', 'check-in'] as const).map(value => <Pressable key={value}
          accessibilityRole="radio" accessibilityState={{ checked: value === 'advice', disabled: saving || !network.ready }}
          disabled={saving || !network.ready}
          onPress={value === 'check-in' ? scheduleCheckIn : () => {}} style={[styles.option, value === 'advice' && styles.selectedOption]}>
          <Text style={{ color: value === 'advice' ? theme.colors.surface : theme.colors.ink }}>
            {value === 'advice' ? 'Advice' : 'Check-in'}
          </Text>
        </Pressable>)}
      </View>

      <Text style={styles.sectionTitle}>Your message</Text>

      <TextInput
        style={styles.messageInput}
        placeholder="Describe your question or what you need help with..."
        value={message}
        onChangeText={(text) => {
          setMessage(text);
          if (error) setError('');
        }}
        multiline
        maxLength={2000}
        textAlignVertical="top"
        accessibilityLabel="Guidance request message"
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Text style={styles.helperText}>
        Review your request next. You can return to edit before confirming.
      </Text>

      {network.loadError ? <><Text style={styles.errorText}>{network.loadError}</Text><AppButton label="Retry loading" onPress={network.reload} /></> : null}
      <AppButton label="Review request" disabled={!network.ready} onPress={review} />
      <AppButton variant="secondary" label="Cancel" disabled={saving} onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.ink,
    marginTop: 8,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.muted,
  },
  optionContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  option: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    color: theme.colors.ink,
    overflow: 'hidden',
  },
  selectedOption: {
    backgroundColor: theme.colors.green,
    color: theme.colors.surface,
  },
  messageInput: {
    minHeight: 140,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.ink,
    fontSize: 16,
  },
  helperText: {
    color: theme.colors.muted,
    fontSize: 13,
  },
  errorText: {
    color: '#B42318',
    fontSize: 14,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.green,
  },
});

import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Screen } from '../../components/Screen';
import { AppButton } from '../../components/AppButton';
import { sampleGuides } from '../../data/sampleData';
import { theme } from '../../theme';

export default function HelpRequestScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const graduateId = Array.isArray(id) ? id[0] : id;

  const graduate = sampleGuides.find((guide) => guide.id === graduateId);

  const [kind, setKind] = useState<'advice' | 'check-in'>('advice');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (!message.trim()) {
      setError('Please enter a message before sending.');
      return;
    }

    setError('');
    setSent(true);
  };

  if (!graduate) {
    return (
      <Screen title="Request guidance">
        <Text style={styles.errorText}>
          Graduate not found. Please return to the People page and try again.
        </Text>
        <AppButton
          label="Back to People"
          onPress={() => router.replace('/people')}
        />
      </Screen>
    );
  }

  if (sent) {
    return (
      <Screen title="Request guidance">
        <View style={styles.card}>
          <Text style={styles.successTitle}>Request sent!</Text>
          <Text style={styles.bodyText}>
            Your guidance request to {graduate.name} has been submitted.
          </Text>

          <Text style={styles.sectionTitle}>Request type</Text>
          <Text style={styles.bodyText}>
            {kind === 'advice' ? 'Advice' : 'Check-in'}
          </Text>

          <Text style={styles.sectionTitle}>Your message</Text>
          <Text style={styles.bodyText}>{message.trim()}</Text>
        </View>

        <AppButton
          label="Back to Profile"
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

  return (
    <Screen
      title="Request guidance"
      subtitle={`Send a guidance request to ${graduate.name}.`}
    >
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Requesting help from</Text>
        <Text style={styles.name}>{graduate.name}</Text>
        <Text style={styles.bodyText}>{graduate.role}</Text>
      </View>

      <Text style={styles.sectionTitle}>What kind of help do you need?</Text>

      <View style={styles.optionContainer}>
        <Text
          onPress={() => setKind('advice')}
          style={[
            styles.option,
            kind === 'advice' && styles.selectedOption,
          ]}
        >
          Advice
        </Text>

        <Text
          onPress={() => setKind('check-in')}
          style={[
            styles.option,
            kind === 'check-in' && styles.selectedOption,
          ]}
        >
          Check-in
        </Text>
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
        textAlignVertical="top"
        accessibilityLabel="Guidance request message"
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Text style={styles.helperText}>
        You can review and edit your message before sending.
      </Text>

      <AppButton label="Send Request" onPress={handleSend} />
      <AppButton label="Cancel" onPress={() => router.back()} />
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
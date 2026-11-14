import { Text, TextInput } from '../../components/Typography';
import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { usePeople } from '../people/PeopleProvider';
import { useNetwork } from './NetworkProvider';
import { useCircleSync } from './useCircleSync';
import { AppButton } from '../../components/AppButton';
import { Screen } from '../../components/Screen';
import { theme } from '../../theme';

export default function GuidanceChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const network = useNetwork();
  const { account } = useAuth();
  const { guides } = usePeople();
  const { syncError, refresh } = useCircleSync();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const list = useRef<FlatList>(null);
  const request = [...network.requests, ...network.inbox].find(item => item.id === id);
  if (!network.ready) return <Screen title="Guidance chat"><Text>{network.loadError || 'Loading your conversation…'}</Text>
    {network.loadError ? <AppButton label="Retry" onPress={network.reload} /> : null}</Screen>;
  if (!request?.delivered) return <Screen title="Chat unavailable"><Text>This request is not a delivered conversation.</Text></Screen>;
  const otherId = request.senderId === account?.id ? request.guideId : request.senderId;
  const name = guides.find(guide => guide.id === otherId)?.name ?? 'Community member';
  const messages = [
    { id: `request-${request.id}`, senderId: request.senderId, body: request.message, createdAt: '' },
    ...network.messages.filter(message => message.requestId === id),
  ];
  const send = async () => {
    if (busy || !draft.trim()) return;
    setBusy(true); setError('');
    try { await network.sendMessage(id, draft); setDraft(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send. Your message is kept.'); }
    finally { setBusy(false); }
  };
  return <SafeAreaView edges={['bottom']} style={styles.screen}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={100}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>{name}</Text>
        <Text style={styles.meta}>Private guidance conversation</Text>
        <AppButton variant="secondary" label="Refresh conversation" onPress={() => void refresh().catch(() => setError('Could not refresh. Please retry.'))} />
      </View>
      <FlatList ref={list} data={messages} keyExtractor={message => message.id}
        contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const mine = item.senderId === account?.id;
          return <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
            <Text style={styles.byline}>{mine ? 'You' : name}</Text>
            <Text style={styles.body}>{item.body}</Text>
            {item.createdAt ? <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString()}</Text> : <Text style={styles.meta}>Guidance request</Text>}
          </View>;
        }} />
      <View style={styles.composer}>
        {syncError || error ? <Text accessibilityRole="alert" style={styles.error}>{error || syncError}</Text> : null}
        <TextInput accessibilityLabel="Chat message" placeholder="Write a message…" multiline maxLength={5000}
          value={draft} onChangeText={setDraft} editable={!busy} style={styles.input} />
        <AppButton label={busy ? 'Sending…' : 'Send message'} disabled={busy || !draft.trim()} onPress={() => void send()} />
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  header: { padding: 16, gap: 6, borderBottomWidth: 1, borderColor: theme.colors.border },
  title: { fontSize: 23, fontWeight: '700', color: theme.colors.ink },
  meta: { fontSize: 12, color: theme.colors.muted },
  messages: { padding: 16, gap: 12, flexGrow: 1, justifyContent: 'flex-end' },
  bubble: { padding: 14, gap: 6, borderRadius: 18, maxWidth: '88%' },
  mine: { alignSelf: 'flex-end', backgroundColor: theme.colors.lime, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: theme.colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: theme.colors.border },
  byline: { fontSize: 12, fontWeight: '700', color: theme.colors.green },
  body: { fontSize: 16, lineHeight: 23, color: theme.colors.ink },
  composer: { padding: 16, gap: 10, borderTopWidth: 1, borderColor: theme.colors.border },
  input: { maxHeight: 140, minHeight: 48, padding: 12, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 16, backgroundColor: theme.colors.surface, color: theme.colors.ink, fontSize: 16 },
  error: { color: '#B42318' },
});

import { useState } from 'react';
import { Text, TextInput, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../components/Screen';
import { AppButton } from '../../components/AppButton';
import { theme } from '../../theme';
import { Topic } from '../../types';
import { useAdvice, PostedQuestion, Visibility, questionRules } from '../advice/AdviceProvider';
import { Chip, ConfirmDialog } from '../advice/ui';

export default function EditQuestionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { postedQuestions, ready, loadError, reload } = useAdvice();
  if (!ready) return <Screen title="Edit question">
    <Text>{loadError || 'Loading your question…'}</Text>
    {loadError ? <AppButton label="Retry loading questions" onPress={reload} /> : null}
  </Screen>;
  const question = postedQuestions.find(q => q.id === id);
  if (!question) return <Screen title="Question unavailable">
    <Text>This question was removed or is not one of your posts.</Text>
    <AppButton label="Back to your questions" onPress={() => router.dismissTo('/my-questions')} />
  </Screen>;
  return <QuestionForm key={question.id} question={question} />;
}

function QuestionForm({ question }: { question: PostedQuestion }) {
  const { updateQuestion } = useAdvice();
  const [title, setTitle] = useState(question.title);
  const [body, setBody] = useState(question.body);
  const [topic, setTopic] = useState<Topic>(question.topic);
  const [visibility, setVisibility] = useState<Visibility>(question.visibility);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  const dirty = title !== question.title || body !== question.body || topic !== question.topic || visibility !== question.visibility;
  const back = () => router.dismissTo('/my-questions');
  const save = async () => {
    if (saving) return;
    if (title.trim().length < questionRules.titleMin) {
      setError(`Write at least ${questionRules.titleMin} characters for your question.`); return;
    }
    setSaving(true); setError('');
    try { await updateQuestion(question.id, { title, body, topic, visibility }); setSaved(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save. Your draft is still here.'); }
    finally { setSaving(false); }
  };
  if (saved) return <Screen title="Question updated">
    <Text style={styles.body}>Your changes are saved on this device and appear in Explore.</Text>
    <AppButton label="Back to your questions" onPress={back} />
    <AppButton label="View updated question" onPress={() => router.push(`/advice/${question.id}`)} />
  </Screen>;
  return <Screen title="Edit your question" subtitle="Update the question, details, topic, or visibility.">
    <Text style={styles.label}>Your question</Text>
    <TextInput accessibilityLabel="Question title" value={title} onChangeText={setTitle}
      style={styles.input} maxLength={questionRules.titleMax} multiline editable={!saving} />
    <Text style={styles.body}>{title.length}/{questionRules.titleMax} characters</Text>
    <Text style={styles.label}>Details (optional)</Text>
    <TextInput accessibilityLabel="Question details" value={body} onChangeText={setBody}
      style={[styles.input, styles.details]} maxLength={questionRules.bodyMax} multiline
      textAlignVertical="top" editable={!saving} />
    <Text style={styles.label}>Topic</Text>
    <View style={styles.choices} accessibilityRole="radiogroup">
      {(['First job', 'Interviews', 'Work life'] as const).map(value =>
        <Chip key={value} label={value} selected={topic === value} onPress={() => { if (!saving) setTopic(value); }} />)}
    </View>
    <Text style={styles.label}>Who can see it?</Text>
    <View style={styles.choices} accessibilityRole="radiogroup">
      {(['Public', 'Anonymous'] as const).map(value =>
        <Chip key={value} label={value} selected={visibility === value} onPress={() => { if (!saving) setVisibility(value); }} />)}
    </View>
    {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    <AppButton label={saving ? 'Saving…' : 'Save question changes'} disabled={saving} onPress={() => void save()} />
    <AppButton label="Cancel editing" disabled={saving} onPress={() => dirty ? setDiscard(true) : back()} />
    <ConfirmDialog visible={discard} title="Discard your edits?" message="Your published question will stay unchanged."
      cancelLabel="Keep editing" confirmLabel="Discard edits" onCancel={() => setDiscard(false)} onConfirm={back} />
  </Screen>;
}
const styles = StyleSheet.create({
  label: { fontSize: 16, fontWeight: '700', color: theme.colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: theme.colors.ink },
  input: { minHeight: 52, padding: 14, backgroundColor: theme.colors.surface, color: theme.colors.ink,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, fontSize: 17 },
  details: { minHeight: 120 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { fontSize: 16, color: '#B42318' },
});

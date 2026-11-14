import { Text } from '../../components/Typography';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { AppButton } from '../../components/AppButton';
import { theme } from '../../theme';
import { useAdvice, PostedQuestion } from '../advice/AdviceProvider';
import { AdviceCard } from '../advice/AdviceCard';
import { ConfirmDialog } from '../advice/ui';

// Profile lists only the demo user's posts, including anonymous questions.
// Seeded community questions are intentionally never editable/deletable here.
export default function PostedQuestionsScreen() {
  const { postedQuestions, ready, loadError, reload, deleteQuestion } = useAdvice();
  const [selected, setSelected] = useState<PostedQuestion | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const remove = async () => {
    if (!selected || deleting) return;
    setDeleting(true); setError('');
    try { await deleteQuestion(selected.id); setSelected(null); setNotice('Question deleted.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete. Please try again.'); setSelected(null); }
    finally { setDeleting(false); }
  };
  return <Screen title="Your posted questions" subtitle="Review, edit, and manage your questions.">
    {!ready ? <>
      <Text style={styles.body}>{loadError || 'Loading your questions…'}</Text>
      {loadError ? <AppButton label="Retry loading questions" onPress={reload} /> : null}
    </> : <>
      {notice ? <Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text> : null}
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      {postedQuestions.length === 0 ? <View style={styles.card}>
        <Text style={styles.heading}>No posted questions yet</Text>
        <Text style={styles.body}>Questions you publish from Ask will appear here, including anonymous posts.</Text>
        <AppButton label="Post a question" onPress={() => router.dismissTo('/ask')} />
      </View> : postedQuestions.map(question => <View key={question.id} style={styles.card}>
        <AdviceCard post={question} />
        <AppButton label="Edit question" accessibilityLabel={`Edit question: ${question.title}`} disabled={deleting}
          onPress={() => router.push({ pathname: '/my-questions/[id]', params: { id: question.id } })} />
        <AppButton variant="danger" label="Delete question" accessibilityLabel={`Delete question: ${question.title}`} disabled={deleting}
          onPress={() => { setError(''); setNotice(''); setSelected(question); }} />
      </View>)}
    </>}
    <ConfirmDialog destructive visible={!!selected} title="Delete this question?"
      message={`“${selected?.title ?? ''}” will be permanently removed. Any follow-up questions will remain as separate posts.`}
      cancelLabel="Keep question" confirmLabel={deleting ? 'Deleting…' : 'Delete question'} disabled={deleting}
      onCancel={() => setSelected(null)} onConfirm={() => void remove()} />
  </Screen>;
}
const styles = StyleSheet.create({
  card: { gap: 12, padding: 16, borderRadius: 16, borderWidth: 1,
    borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  heading: { color: theme.colors.ink, fontSize: 20, fontWeight: '700' },
  body: { color: theme.colors.ink, fontSize: 16, lineHeight: 24 },
  notice: { color: theme.colors.green, fontSize: 16, fontWeight: '600' },
  error: { color: '#B42318', fontSize: 16 },
});

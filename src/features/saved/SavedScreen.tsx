import { router } from 'expo-router';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SavedItem, useSavedAdvice } from '../../state/SavedAdviceContext';
import { theme } from '../../theme';
import { GuideByline } from '../advice/AdviceCard';
import { useAdvice } from '../advice/AdviceProvider';
import { useAnswers } from '../advice/AnswersProvider';
import { ActionButton, AdviceScreen, announce, Snackbar } from '../advice/ui';

/**
 * Owners: Mourede + Hoa (co-owned; coordinate edits with each other).
 * Tips the user saved from advice answers. Text and author names are looked up
 * from the shared data, so they match the advice screen exactly.
 * No "save" button here: participants found it confusing on a page of saved items.
 * After Remove, an Undo option stays on screen for a few seconds.
 */

const UNDO_SECONDS = 6;

export default function SavedScreen() {
  const {
    saved, saveAdvice, removeAdvice,
    ready: savesReady,
    loadError: savesError,
    reload: reloadSaves,
  } = useSavedAdvice();
  const { findPost } = useAdvice();
  const {
    findAnswer,
    findGuide,
    ready: answersReady,
    loadError: answersError,
    reload: reloadAnswers,
  } = useAnswers();
  const [status, setStatus] = useState<{ message: string; undo?: SavedItem } | null>(null);
  const hideStatus = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(hideStatus.current), []);

  const showStatus = (message: string, undo?: SavedItem) => {
    setStatus({ message, undo });
    announce(undo ? `${message} Undo is available.` : message);
    clearTimeout(hideStatus.current);
    hideStatus.current = setTimeout(() => setStatus(null), UNDO_SECONDS * 1000);
  };

  const remove = (item: SavedItem, authorName?: string) => {
    removeAdvice(item.answerId)
      .then(() => showStatus(authorName ? `Removed ${authorName}’s tip.` : 'Tip removed.', item))
      .catch(() => showStatus('Could not remove this tip. Please try again.'));
  };

  const undo = (item: SavedItem) => {
    saveAdvice(item.answerId, item.adviceId)
      .then(() => showStatus('Tip restored.'))
      .catch(() => showStatus('Could not restore this tip. Please try again.'));
  };

  // The status bar sits outside the scrolling list so it is always visible.
  const withStatus = (content: ReactNode) => (
    <View style={styles.page}>
      {content}
      {status ? <Snackbar message={status.message}
        actionLabel={status.undo ? 'Undo' : undefined}
        onAction={status.undo ? () => undo(status.undo!) : undefined} /> : null}
    </View>
  );

  // Wait for saved records before showing an empty list.
  if (!savesReady) {
    return withStatus(
      <AdviceScreen title="Saved advice">
        <Text>{savesError || 'Loading saved advice…'}</Text>
        {savesError ? (
          <ActionButton label="Retry loading saved advice" onPress={reloadSaves} />
        ) : null}
      </AdviceScreen>,
    );
  }

  // Wait before deciding that a saved answer is unavailable.
  if (!answersReady) {
    return withStatus(
      <AdviceScreen title="Saved advice">
        <Text>{answersError || 'Loading answers…'}</Text>
        {answersError ? (
          <ActionButton label="Retry loading answers" onPress={reloadAnswers} />
        ) : null}
      </AdviceScreen>,
    );
  }

  if (saved.length === 0) {
    return withStatus(<AdviceScreen eyebrow="SAVED" title="Advice worth keeping" subtitle="Tips you save from answers will appear here.">
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No saved tips yet</Text>
        <Text style={styles.emptyText}>Open a question and tap “Save this tip” on an answer that helps you.</Text>
      </View>
      <ActionButton label="Explore questions" onPress={() => router.navigate('/')} />
    </AdviceScreen>);
  }

  return withStatus(<AdviceScreen eyebrow="SAVED" title="Advice worth keeping"
    subtitle={`${saved.length} saved ${saved.length === 1 ? 'tip' : 'tips'}`}>
    {saved.map(item => {
      const answer = findAnswer(item.answerId);
      const guide = answer ? findGuide(answer.guideId) : undefined;
      const question = findPost(item.adviceId);
      return (
        <View key={item.answerId} style={styles.card}>
          {answer ? (
            <Pressable onPress={() => router.push(`/advice/${item.adviceId}`)} accessibilityRole="button"
              accessibilityLabel={`Tip from ${guide?.name ?? 'a graduate'}: ${answer.body}. Open the question ${question?.title ?? ''}`}
              style={({ pressed }) => [styles.open, pressed && { opacity: 0.7 }]}>
              {guide ? <GuideByline guide={guide} fromLabel /> : null}
              <Text style={styles.tip}>“{answer.body}”</Text>
              {question ? <Text style={styles.from}>On: {question.title} ›</Text> : null}
            </Pressable>
          ) : (
            <Text style={styles.emptyText}>This tip is no longer available.</Text>
          )}
          <View style={styles.divider} />
          <Pressable onPress={() => remove(item, guide?.name)} accessibilityRole="button"
            accessibilityLabel={guide ? `Remove ${guide.name}’s tip` : 'Remove tip'}
            style={({ pressed }) => [styles.remove, pressed && { opacity: 0.7 }]}>
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      );
    })}
  </AdviceScreen>);
}

const { colors, spacing } = theme;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  empty: { padding: 20, borderRadius: 18, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  emptyTitle: { fontSize: 19, fontWeight: '800', color: colors.ink },
  emptyText: { fontSize: 16, lineHeight: 23, color: colors.ink },
  card: { padding: 20, borderRadius: 18, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  open: { gap: spacing.md },
  tip: { fontSize: 18, lineHeight: 27, color: colors.ink },
  from: { fontSize: 15, fontWeight: '700', color: colors.green },
  divider: { height: 1, backgroundColor: colors.border },
  remove: { alignSelf: 'flex-start', minHeight: 44, minWidth: 88, paddingHorizontal: spacing.md, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.border },
  removeText: { fontSize: 15, fontWeight: '700', color: colors.ink },
});

import { Text, TextInput } from '../../components/Typography';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSavedAdvice } from '../../state/SavedAdviceContext';
import { theme } from '../../theme';
import { AdviceCard, GuideByline } from './AdviceCard';
import { questionAuthorLabel } from './questionAuthor';
import { isPostedQuestion, useAdvice } from './AdviceProvider';
import { firstName } from './answers';
import { useAnswers } from './AnswersProvider';
import { findSimilar } from './search';
import { ActionButton, AdviceScreen, announce, SectionLabel, TextLink } from './ui';

/**
 * Owner: Mourede.
 * Shows one question, the answers graduates gave, and similar experiences.
 * Each answer can be saved to the Saved tab, and links to its author
 * (the hand-off to the Ask for Help task). The stack header gives the back button.
 * Jumps to a tab use dismissTo: it returns to the existing tabs (keeping the Ask draft)
 * instead of stacking a second copy of them on top.
 */
export default function AdviceDetailScreen() {
  // The [id] part of the URL, e.g. "first-week" for /advice/first-week.
  const { id } = useLocalSearchParams<{ id: string }>();
  const { posts, findPost } = useAdvice();
  const {
    isSaved, saveAdvice, removeAdvice,
    ready: savesReady,
    busy: savesBusy,
    loadError: savesError,
    reload: reloadSaves,
  } = useSavedAdvice();
  const {
    answersFor,
    findGuide,
    postAnswer,
    ready: answersReady,
    loadError: answersError,
    reload: reloadAnswers,
  } = useAnswers();
  const [answerDraft, setAnswerDraft] = useState('');
  const [answerPosting, setAnswerPosting] = useState(false);
  const [answerError, setAnswerError] = useState('');
  const [answerNotice, setAnswerNotice] = useState('');
  const [notice, setNotice] = useState<{ answerId: string; text: string; viewSaved: boolean } | null>(null);
  const hideNotice = useRef<ReturnType<typeof setTimeout>>(undefined);
  const post = findPost(id);

  useEffect(() => () => clearTimeout(hideNotice.current), []);

  if (!post) {
    return <AdviceScreen title="Question not found" subtitle="It may have been removed.">
      <ActionButton label="Back to Explore" onPress={() => router.dismissTo('/')} />
    </AdviceScreen>;
  }

  const answers = answersFor(post.id);
  const similar = findSimilar(`${post.title} ${post.body}`, post.topic, posts, { excludeId: post.id });
  const posted = isPostedQuestion(post) ? post : null;
  const parent = posted?.followUpOf ? findPost(posted.followUpOf) : undefined;

  const submitAnswer = async () => {
    if (answerPosting) return;

    setAnswerPosting(true);
    setAnswerError('');
    setAnswerNotice('');

    try {
      await postAnswer(post.id, answerDraft);
      setAnswerDraft('');
      setAnswerNotice('Your answer was posted.');
    } catch (cause) {
      setAnswerError(
        cause instanceof Error
          ? cause.message
          : 'Your answer could not be posted.',
      );
    } finally {
      setAnswerPosting(false);
    }
  };

  // The confirmation appears under the answer that was tapped, so it is always on screen.
  const showNotice = (answerId: string, text: string, viewSaved: boolean) => {
    setNotice({ answerId, text, viewSaved });
    clearTimeout(hideNotice.current);
    hideNotice.current = setTimeout(() => setNotice(null), 5000);
  };

  const toggleSave = async (answerId: string) => {
    const wasSaved = isSaved(answerId);
    try {
      if (wasSaved) await removeAdvice(answerId);
      else await saveAdvice(answerId, post.id);
      const message = wasSaved ? 'Tip removed from Saved.' : 'Tip saved.';
      showNotice(answerId, message, !wasSaved);
      announce(message);
    } catch {
      showNotice(answerId, 'That did not work. Please try again.', false);
      announce('That did not work. Please try again.');
    }
  };

  return <AdviceScreen eyebrow={post.topic.toUpperCase()} title={post.title}
    subtitle={`${answers.length} ${answers.length === 1 ? 'answer' : 'answers'}`}>
    <View style={styles.question}>
      <Text style={styles.questionLabel}>THE QUESTION</Text>
      <Text style={styles.questionText}>{post.body || post.title}</Text>
      {posted ? (
        <Text style={styles.questionMeta}>
          {questionAuthorLabel(posted)}
        </Text>
      ) : null}
      {parent ? <TextLink label={`Follow-up to: ${parent.title} ›`} accessibilityLabel={`Open the original question, ${parent.title}`}
        onPress={() => router.push(`/advice/${parent.id}`)} /> : null}
    </View>

    {/* Only database questions can receive real answers. */}
    {posted ? (
      <View style={styles.answer}>
        <Text style={styles.questionLabel}>SHARE YOUR EXPERIENCE</Text>
        <TextInput
          accessibilityLabel="Your answer"
          placeholder="What advice would you give?"
          placeholderTextColor={colors.muted}
          value={answerDraft}
          onChangeText={setAnswerDraft}
          multiline
          maxLength={5000}
          editable={!answerPosting}
          style={styles.answerInput}
        />
        {answerError ? <Text accessibilityRole="alert">{answerError}</Text> : null}
        {answerNotice ? <Text accessibilityLiveRegion="polite">{answerNotice}</Text> : null}
        <ActionButton
          label={answerPosting ? 'Posting…' : 'Post answer'}
          disabled={answerPosting || !answersReady || !answerDraft.trim()}
          onPress={() => void submitAnswer()}
        />
      </View>
    ) : null}

    {!answersReady ? (
      <View>
        <Text>{answersError || 'Loading answers…'}</Text>
        {answersError ? <ActionButton label="Retry loading answers" onPress={reloadAnswers} /> : null}
      </View>
    ) : (
      <TextLink label="Refresh answers" onPress={reloadAnswers} />
    )}

    {/* Explain why saving is unavailable and offer a retry. */}
    {!savesReady ? (
      <View>
        <Text>{savesError || 'Loading saved advice…'}</Text>
        {savesError ? (
          <ActionButton label="Retry loading saved advice" onPress={reloadSaves} />
        ) : null}
      </View>
    ) : null}

    <SectionLabel>Voices from the field</SectionLabel>
    {!answersReady ? null : answers.length === 0 ? (
      <Text style={styles.empty}>No answers yet. The similar experiences below may help in the meantime.</Text>
    ) : answers.map(answer => {
      const guide = findGuide(answer.guideId);
      const saved = isSaved(answer.id);
      return (
        <View key={answer.id} style={styles.answer}>
          {guide ? posted ? (
            // Real authors do not yet have a People profile route.
            <GuideByline guide={guide} />
          ) : (
            <Pressable onPress={() => router.push(`/people/${guide.id}`)} accessibilityRole="link"
              accessibilityLabel={`View ${firstName(guide.name)}’s profile`}
              style={({ pressed }) => pressed && { opacity: 0.7 }}>
              <GuideByline guide={guide} link={`View ${firstName(guide.name)}’s profile`} />
            </Pressable>
          ) : null}
          <Text style={styles.answerBody}>“{answer.body}”</Text>
          <View style={styles.actions}>
            <Pressable onPress={() => toggleSave(answer.id)}
              disabled={!savesReady || savesBusy}
              accessibilityRole="button"
              accessibilityState={{ selected: saved, disabled: !savesReady || savesBusy }} aria-selected={saved}
              accessibilityLabel={saved ? `Saved. ${guide?.name ?? 'This'}’s tip is in Saved` : `Save this tip from ${guide?.name ?? 'this graduate'}`}
              accessibilityHint={saved ? 'Double tap to remove it from Saved' : 'Adds it to your Saved tab'}
              style={({ pressed }) => [styles.action, saved && styles.actionSaved, pressed && { opacity: 0.7 }]}>
              <Text style={[styles.actionText, saved && styles.actionTextSaved]}>{saved ? 'Saved ✓' : 'Save this tip'}</Text>
            </Pressable>
            {guide && !posted ? (
              <Pressable onPress={() => router.push({ pathname: '/people/request', params: { id: guide.id } })}
                accessibilityRole="button" accessibilityLabel={`Ask ${guide.name} for advice`}
                style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}>
                <Text style={styles.actionText}>Ask {firstName(guide.name)} for advice</Text>
              </Pressable>
            ) : null}
          </View>
          {notice?.answerId === answer.id ? (
            <View style={styles.notice} accessibilityLiveRegion="polite" aria-live="polite">
              <Text style={styles.noticeText}>{notice.text}</Text>
              {notice.viewSaved ? <TextLink label="View saved" onDark onPress={() => router.dismissTo('/saved')} /> : null}
            </View>
          ) : null}
        </View>
      );
    })}

    {similar.length > 0 ? <>
      <SectionLabel>Similar experiences</SectionLabel>
      {similar.map(item => <AdviceCard key={item.id} post={item} />)}
    </> : null}

    {/* A follow-up stays linked to this question; it is not a brand-new question (DP3 issue #12). */}
    <View style={styles.followUp}>
      <Text style={styles.followUpText}>Still unsure about “{post.title}”?</Text>
      <ActionButton label="Post a follow-up to this question"
        onPress={() => router.dismissTo({ pathname: '/ask', params: { followUp: post.id } })} />
    </View>
  </AdviceScreen>;
}

const { colors, spacing } = theme;

const styles = StyleSheet.create({
  question: { padding: 20, borderRadius: 18, backgroundColor: colors.lime, gap: spacing.sm },
  questionLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, color: colors.green },
  questionText: { fontSize: 19, lineHeight: 26, fontWeight: '800', color: colors.ink },
  questionMeta: { fontSize: 14, fontWeight: '600', color: colors.green },
  empty: { fontSize: 16, lineHeight: 23, color: colors.ink },
  answer: { padding: 20, borderRadius: 18, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  answerBody: { fontSize: 18, lineHeight: 27, color: colors.ink },
  answerInput: { minHeight: 120, padding: 14, borderWidth: 1,
    borderColor: colors.border, borderRadius: 12, color: colors.ink,
    fontSize: 16, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  // Two equal buttons side by side; long labels wrap inside the button instead of pushing it to a new row.
  action: { flex: 1, minHeight: 48, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.green, backgroundColor: colors.surface },
  actionSaved: { backgroundColor: colors.green },
  actionText: { fontSize: 15, fontWeight: '700', color: colors.green, textAlign: 'center' },
  actionTextSaved: { color: colors.surface },
  notice: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: spacing.md,
    paddingVertical: 4, paddingHorizontal: spacing.md, borderRadius: 12, backgroundColor: colors.green },
  noticeText: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: colors.surface, paddingVertical: 10 },
  followUp: { gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  followUpText: { fontSize: 16, fontWeight: '600', color: colors.ink },
});

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../../theme';
import { Topic } from '../../types';
import { AdviceCard } from '../advice/AdviceCard';
import { PostedQuestion, useAdvice, Visibility, questionRules } from '../advice/AdviceProvider';
import { findSimilar } from '../advice/search';
import { ActionButton, AdviceScreen, announce, Chip, ConfirmDialog, SectionLabel, TextLink } from '../advice/ui';

/**
 * Owner: Mourede.
 * Post a question in three steps: write it, review it, then see a confirmation.
 * The draft lives in this screen's state, so going back from review or switching tabs keeps it.
 * Before anything would throw a draft away, the user is asked first.
 * Opened with ?followUp=<question id>, the new question is linked to that question.
 * Wording: "Post a question" here; "Ask <name> for advice" is the one-to-one request (DP3 issue #5).
 */

type Step = 'write' | 'review' | 'done';
const TOPICS: Topic[] = ['First job', 'Interviews', 'Work life'];
const VISIBILITY: { value: Visibility; label: string; hint: string }[] = [
  { value: 'Public', label: 'Everyone, with my name', hint: 'Graduates and students see who asked.' },
  { value: 'Anonymous', label: 'Everyone, anonymously', hint: 'Others see “Anonymous” instead of your name.' },
];
const TITLE_MIN = questionRules.titleMin;
const TITLE_MAX = questionRules.titleMax;
const BODY_MAX = questionRules.bodyMax;

export default function AskScreen() {
  const { posts, findPost, postQuestion } = useAdvice();
  const params = useLocalSearchParams<{ followUp?: string }>();
  const [step, setStep] = useState<Step>('write');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [topic, setTopic] = useState<Topic | null>(null);
  const [visibility, setVisibility] = useState<Visibility>('Public');
  const [followUpOf, setFollowUpOf] = useState<string | undefined>(undefined);
  const [showErrors, setShowErrors] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [posted, setPosted] = useState<PostedQuestion | null>(null);
  // A follow-up waiting for the user to decide what happens to their unfinished draft.
  const [pendingFollowUp, setPendingFollowUp] = useState<string | null>(null);
  const hasDraft = step !== 'done' && (title.trim() !== '' || body.trim() !== '');

  const startFollowUp = (parentId: string) => {
    const parent = findPost(parentId);
    if (!parent) return;
    setTitle(''); setBody(''); setShowErrors(false);
    setFollowUpOf(parent.id);
    setTopic(parent.topic);
    setStep('write');
  };

  // Arriving from "Post a follow-up to this question": link it and start on the same topic,
  // but never silently replace a different question the user was still writing.
  useEffect(() => {
    if (!params.followUp || params.followUp === followUpOf || !findPost(params.followUp)) return;
    if (hasDraft) { setStep('write'); setPendingFollowUp(params.followUp); }
    else startFollowUp(params.followUp);
  }, [params.followUp]);

  // On web, warn before a reload or closing the tab would lose the draft.
  useEffect(() => {
    if (Platform.OS !== 'web' || !hasDraft) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasDraft]);

  const parent = followUpOf ? findPost(followUpOf) : undefined;
  const pendingParent = pendingFollowUp ? findPost(pendingFollowUp) : undefined;

  const errors = {
    title: title.trim().length < TITLE_MIN ? `Write at least ${TITLE_MIN} characters so others understand your question.` : '',
    topic: topic ? '' : 'Choose the topic that fits best.',
  };
  const valid = !errors.title && !errors.topic;

  // Questions others already asked, so the user can read those answers first.
  const similar = title.trim().length >= TITLE_MIN
    ? findSimilar(`${title} ${body}`, topic ?? undefined, posts, { needSharedWord: true, excludeId: followUpOf })
    : [];

  const unlinkFollowUp = () => {
    setFollowUpOf(undefined);
    router.setParams({ followUp: undefined });
  };

  const review = () => {
    setShowErrors(true);
    if (valid) setStep('review');
  };

  const publish = async () => {
    if (!topic) return;
    setPosting(true);
    setPostError('');
    try {
      setPosted(await postQuestion({ title, body, topic, visibility, followUpOf }));
      setStep('done');
      announce('Question posted.');
    } catch {
      setPostError('Your question could not be posted. Your draft is still here. Please try again.');
      announce('Your question could not be posted. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  // Clears the form so the Ask tab starts fresh next time.
  const startOver = () => {
    setTitle(''); setBody(''); setTopic(null); setVisibility('Public'); unlinkFollowUp();
    setShowErrors(false); setPostError(''); setPosted(null); setStep('write');
  };

  if (step === 'done' && posted) {
    return <ScrollView style={styles.done} contentContainerStyle={styles.doneContent}>
      <View style={styles.check} accessibilityElementsHidden importantForAccessibility="no">
        <Text style={styles.checkMark}>✓</Text>
      </View>
      <Text accessibilityRole="header" style={styles.doneTitle}>Question posted!</Text>
      <Text style={styles.doneText}>
        Graduates who have been there can now answer “{posted.title}”.
        {posted.visibility === 'Anonymous' ? ' Your name is hidden.' : ''}
      </Text>
      <View style={styles.doneActions}>
        <ActionButton variant="onDark" label="See my question →"
          onPress={() => { router.push(`/advice/${posted.id}`); startOver(); }} />
        <ActionButton variant="onDarkQuiet" label="Back to Explore"
          onPress={() => { router.navigate('/'); startOver(); }} />
      </View>
    </ScrollView>;
  }

  if (step === 'review') {
    return <AdviceScreen hero eyebrow="POST A QUESTION · REVIEW" title="Look good?"
      subtitle="This is how your question will appear to others.">
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>{topic?.toUpperCase()}</Text>
        <Text style={styles.summaryTitle}>{title.trim()}</Text>
        {body.trim() ? <Text style={styles.summaryBody}>{body.trim()}</Text> : null}
        <View style={styles.divider} />
        <Text style={styles.summaryMeta}>Who can see it: {VISIBILITY.find(v => v.value === visibility)?.label}</Text>
        {parent ? <Text style={styles.summaryMeta}>Follow-up to: {parent.title}</Text> : null}
      </View>
      {postError ? <Text style={styles.error} accessibilityLiveRegion="polite">{postError}</Text> : null}
      <ActionButton label={posting ? 'Publishing…' : 'Publish question'} onPress={publish} disabled={posting} />
      <ActionButton variant="secondary" label="Edit question" onPress={() => setStep('write')} disabled={posting} />
    </AdviceScreen>;
  }

  return <AdviceScreen hero eyebrow={parent ? 'POST A FOLLOW-UP' : 'POST A QUESTION'} title="What’s on your mind?"
    subtitle="Graduates who have been there will answer.">
    {parent ? (
      <View style={styles.linked}>
        <Text style={styles.linkedLabel}>FOLLOWING UP ON</Text>
        <Text style={styles.linkedTitle}>{parent.title}</Text>
        <TextLink label="Make this a new question instead" onPress={unlinkFollowUp}
          accessibilityLabel={`Stop linking to ${parent.title} and make this a new question`} />
      </View>
    ) : null}

    <View style={styles.group}>
      <SectionLabel>Topic</SectionLabel>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {TOPICS.map(t => <Chip key={t} label={t} selected={t === topic} onPress={() => setTopic(t)} />)}
      </View>
      {showErrors && errors.topic ? <Text style={styles.error}>{errors.topic}</Text> : null}
    </View>

    <View style={styles.group}>
      <SectionLabel>Your question</SectionLabel>
      <View style={styles.box}>
        <TextInput style={styles.titleInput} value={title} onChangeText={setTitle} maxLength={TITLE_MAX} multiline
          placeholder="e.g. How do I prepare for my first performance review?"
          placeholderTextColor={theme.colors.muted} accessibilityLabel="Your question" />
        <View style={styles.divider} />
        <TextInput style={styles.bodyInput} value={body} onChangeText={setBody}
          maxLength={BODY_MAX} multiline textAlignVertical="top"
          placeholder="Add some context about your situation (optional)."
          placeholderTextColor={theme.colors.muted} accessibilityLabel="Question details" />
      </View>
      <Text style={styles.hint}>{title.length}/{TITLE_MAX} characters</Text>
      {showErrors && errors.title ? <Text style={styles.error}>{errors.title}</Text> : null}
    </View>

    {similar.length > 0 ? <View style={styles.group}>
      <SectionLabel>Others asked something similar</SectionLabel>
      <Text style={styles.hint}>Their answers might already help you.</Text>
      {similar.map(post => <AdviceCard key={post.id} post={post} />)}
    </View> : null}

    <View style={styles.group}>
      <SectionLabel>Who can see it?</SectionLabel>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {VISIBILITY.map(v => {
          const selected = v.value === visibility;
          return (
            <Pressable key={v.value} onPress={() => setVisibility(v.value)}
              accessibilityRole="radio" aria-checked={selected} accessibilityLabel={`${v.label}. ${v.hint}`}
              style={[styles.option, selected && styles.optionSelected]}>
              <View style={[styles.radio, selected && styles.radioSelected]} />
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>{v.label}</Text>
                <Text style={styles.hint}>{v.hint}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>

    <ActionButton label="Review question →" onPress={review} />

    <ConfirmDialog visible={!!pendingParent}
      title="Keep your unfinished question?"
      message={`You were writing “${title.trim() || body.trim()}”. Starting a follow-up to “${pendingParent?.title}” will clear it.`}
      cancelLabel="Keep my draft"
      confirmLabel="Discard and start follow-up"
      onCancel={() => { setPendingFollowUp(null); router.setParams({ followUp: undefined }); }}
      onConfirm={() => { if (pendingFollowUp) startFollowUp(pendingFollowUp); setPendingFollowUp(null); }} />
  </AdviceScreen>;
}

const { colors, spacing } = theme;

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  box: { borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 12 },
  titleInput: { minHeight: 56, fontSize: 19, lineHeight: 26, fontWeight: '700', color: colors.ink, paddingVertical: 4 },
  bodyInput: { minHeight: 96, fontSize: 16, lineHeight: 23, color: colors.ink, paddingVertical: 4 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  hint: { fontSize: 14, color: colors.ink },
  // Dark text with an orange bar: orange text alone is too low-contrast to read (DP3 issue #14).
  error: { fontSize: 15, fontWeight: '700', color: colors.ink, borderLeftWidth: 4, borderLeftColor: colors.orange, paddingLeft: 10 },
  options: { gap: spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderRadius: 16,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  optionSelected: { borderColor: colors.green, backgroundColor: colors.lime },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.green },
  radioSelected: { borderWidth: 7 },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 16, fontWeight: '700', color: colors.ink },
  linked: { padding: spacing.md, borderRadius: 16, backgroundColor: colors.lime, gap: 4 },
  linkedLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, color: colors.green },
  linkedTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  summary: { padding: 20, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  summaryLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, color: colors.green },
  summaryTitle: { fontSize: 21, lineHeight: 27, fontWeight: '800', color: colors.ink },
  summaryBody: { fontSize: 16, lineHeight: 23, color: colors.ink },
  summaryMeta: { fontSize: 15, fontWeight: '600', color: colors.ink },
  done: { flex: 1, backgroundColor: colors.green },
  doneContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.md },
  check: { width: 128, height: 128, borderRadius: 64, backgroundColor: colors.lime,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  checkMark: { fontSize: 64, fontWeight: '800', color: colors.green },
  doneTitle: { fontSize: 34, fontWeight: '800', color: colors.surface, textAlign: 'center' },
  doneText: { fontSize: 17, lineHeight: 25, color: colors.surface, textAlign: 'center' },
  doneActions: { alignSelf: 'stretch', gap: 12, marginTop: spacing.xl },
});

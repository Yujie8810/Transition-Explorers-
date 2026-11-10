import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';
import { Advice, Guide, Topic } from '../../types';
import { isPostedQuestion } from './AdviceProvider';
import { questionAuthorLabel } from './questionAuthor';
import { gradLabel, initials, nameLine, roleLine } from './answers';
import { useAnswers } from './AnswersProvider';

// The thin colored bar beside each card's label, one color per topic (decoration only).
const TOPIC_ACCENT: Record<Topic, string> = {
  'First job': theme.colors.lime, Interviews: theme.colors.orange, 'Work life': theme.colors.green,
};

/** A tappable question preview that opens the advice detail screen. Used by the feed and similar lists. */
export function AdviceCard({ post }: { post: Advice }) {
  const authorLabel = isPostedQuestion(post) ? questionAuthorLabel(post) : '';
  const { answersFor } = useAnswers();
  const count = answersFor(post.id).length;
  return (
    <Pressable onPress={() => router.push(`/advice/${post.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${post.title}. ${post.topic}, ${count} ${count === 1 ? 'answer' : 'answers'}${authorLabel ? `. ${authorLabel}` : ''}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
      <View style={styles.row}>
        <View style={[styles.accent, { backgroundColor: TOPIC_ACCENT[post.topic] }]} />
        <Text style={styles.label}>{post.topic.toUpperCase()} · {count} {count === 1 ? 'ANSWER' : 'ANSWERS'}</Text>
      </View>
      <Text style={styles.title}>{post.title}</Text>
      {post.body ? <Text style={styles.body} numberOfLines={2}>{post.body}</Text> : null}
      {authorLabel ? <Text style={styles.badge}>{authorLabel}</Text> : null}
    </Pressable>
  );
}

/**
 * Round initials avatar, "Name · UTD 'yy" and "Role · N years in" for an answer's author.
 * With fromLabel (Saved cards), the name line becomes "FROM ANIKA KUMAR" and the grad year moves to the role line.
 * link adds a small underlined line, used when the whole byline is tappable.
 */
export function GuideByline({ guide, fromLabel = false, link }: { guide: Guide; fromLabel?: boolean; link?: string }) {
  return (
    <View style={styles.byline}>
      <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
        <Text style={styles.avatarText} maxFontSizeMultiplier={1.2}>{initials(guide.name)}</Text>
      </View>
      <View style={styles.bylineText}>
        {fromLabel
          ? <Text style={styles.bylineLabel}>FROM {guide.name.toUpperCase()}</Text>
          : <Text style={styles.guideName}>{nameLine(guide)}</Text>}
        <Text style={styles.guideRole}>
          {roleLine(guide)}{fromLabel && guide.gradYear ? ` · ${gradLabel(guide.gradYear)}` : ''}
        </Text>
        {link ? <Text style={styles.bylineLink}>{link}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, borderRadius: 18, backgroundColor: theme.colors.surface, gap: 8,
    borderWidth: 1, borderColor: theme.colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accent: { width: 4, alignSelf: 'stretch', minHeight: 16, borderRadius: 2 },
  label: { flexShrink: 1, fontSize: 13, fontWeight: '700', letterSpacing: 0.6, color: theme.colors.green },
  title: { fontSize: 21, lineHeight: 27, fontWeight: '800', color: theme.colors.ink },
  body: { fontSize: 15, lineHeight: 22, color: theme.colors.muted },
  badge: { alignSelf: 'flex-start', fontSize: 13, fontWeight: '700', color: theme.colors.green,
    backgroundColor: theme.colors.lime, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.lime,
    alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800', color: theme.colors.green },
  bylineText: { flex: 1, gap: 2 },
  bylineLabel: { fontSize: 14, fontWeight: '800', letterSpacing: 0.6, color: theme.colors.green },
  guideName: { fontSize: 18, fontWeight: '800', color: theme.colors.ink },
  guideRole: { fontSize: 14, color: theme.colors.ink },
  bylineLink: { fontSize: 14, fontWeight: '700', color: theme.colors.green, textDecorationLine: 'underline', marginTop: 2 },
});

import { Text, TextInput } from '../../components/Typography';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { theme } from '../../theme';
import { Topic } from '../../types';
import { AdviceCard } from './AdviceCard';
import { useAdvice } from './AdviceProvider';
import { matchesSearch } from './search';
import { ActionButton, Chip, SectionLabel } from './ui';

/**
 * Owner: Mourede.
 * The list of advice posts shown on Explore, with search and topic filters.
 * It lives in the advice folder so Aproteem can design the rest of the
 * Explore (home) screen without editing the same file.
 */

type Filter = 'All' | Topic;
const FILTERS: Filter[] = ['All', 'First job', 'Interviews', 'Work life'];

export function AdviceFeed() {
  // useState stores values that change while the screen is open.
  // When one changes, React redraws the screen automatically.
  const [filter, setFilter] = useState<Filter>('All');
  const [search, setSearch] = useState('');
  const { posts: allPosts } = useAdvice();

  // Keep only posts that match the chosen topic AND every search word.
  const posts = allPosts.filter(post =>
    (filter === 'All' || post.topic === filter) && matchesSearch(post, search));

  return (
    <View style={styles.wrapper}>
      <View style={styles.search}>
        <Text style={styles.searchIcon} accessibilityElementsHidden importantForAccessibility="no" maxFontSizeMultiplier={1.2}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search questions"
          placeholderTextColor={theme.colors.muted}
          value={search}
          onChangeText={setSearch}
          accessibilityLabel="Search questions"
          returnKeyType="search"
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear search"
            style={({ pressed }) => [styles.clear, pressed && { opacity: 0.6 }]}>
            <Text style={styles.clearText} maxFontSizeMultiplier={1.3}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.group}>
        <SectionLabel>Filter discussions</SectionLabel>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {FILTERS.map(f => <Chip key={f} label={f} selected={f === filter} onPress={() => setFilter(f)} />)}
        </View>
      </View>

      <View style={styles.listHeader}>
        <Text accessibilityRole="header" style={styles.heading}>From people who’ve been there</Text>
        <Text style={styles.count} accessibilityLiveRegion="polite" aria-live="polite">
          {posts.length} {posts.length === 1 ? 'question' : 'questions'}
        </Text>
      </View>

      {posts.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.empty}>No questions match. Try another word or post your own question.</Text>
          {search || filter !== 'All'
            ? <ActionButton variant="secondary" label="Clear search and filters" onPress={() => { setSearch(''); setFilter('All'); }} />
            : null}
          <ActionButton label="Post a question" onPress={() => router.navigate('/ask')} />
        </View>
      ) : (
        posts.map(post => <AdviceCard key={post.id} post={post} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: theme.spacing.md },
  search: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, minHeight: 56,
    paddingHorizontal: theme.spacing.md, borderRadius: 18, backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border },
  searchIcon: { fontSize: 22, color: theme.colors.ink },
  searchInput: { flex: 1, minHeight: 54, fontSize: 18, color: theme.colors.ink },
  clear: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 18, fontWeight: '700', color: theme.colors.ink },
  group: { gap: theme.spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  listHeader: { gap: 4, marginTop: theme.spacing.sm },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: theme.colors.ink },
  count: { fontSize: 14, fontWeight: '600', color: theme.colors.ink },
  emptyBox: { padding: theme.spacing.lg, borderRadius: 18, backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border, gap: theme.spacing.md },
  empty: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: theme.colors.ink, textAlign: 'center' },
});

import { Advice, Topic } from '../../types';

// Common words that say nothing about what a question is about.
const IGNORED = new Set(['the', 'and', 'for', 'how', 'what', 'when', 'should', 'can', 'does', 'with',
  'you', 'your', 'are', 'not', 'have', 'this', 'that', 'about', 'from', 'get', 'any', 'job', 'ask',
  'first', 'know', 'like', 'one', 'feel', 'feeling', 'okay', 'want', 'new', 'there', 'been', 'never', 'much',
  'more', 'than', 'time', 'question', 'seem', 'seems', 'lot', 'everyone', 'someone', 'yet']);

/** The meaningful words in a piece of text, e.g. "How do I negotiate offers?" -> {negotiate, offer}. */
function keywords(text: string) {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return new Set(words
    .filter(word => word.length > 2 && !IGNORED.has(word))
    .map(word => word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word)); // "interviews" -> "interview"
}

/** True when every word typed in the search box appears somewhere in the post. */
export function matchesSearch(post: Advice, search: string) {
  const text = `${post.title} ${post.body} ${post.topic}`.toLowerCase();
  return search.toLowerCase().split(/\s+/).filter(Boolean).every(word => text.includes(word));
}

/**
 * Posts most similar to some text: each shared keyword counts 2 points and the same topic 1 point.
 * With needSharedWord, a post must share at least one keyword (topic alone is not enough).
 */
export function findSimilar(text: string, topic: Topic | undefined, posts: Advice[],
  { excludeId, needSharedWord = false, limit = 3 }: { excludeId?: string; needSharedWord?: boolean; limit?: number } = {}) {
  const wanted = keywords(text);
  return posts
    .filter(post => post.id !== excludeId)
    .map(post => {
      const shared = [...keywords(`${post.title} ${post.body}`)].filter(word => wanted.has(word)).length;
      return { post, shared, score: shared * 2 + (post.topic === topic ? 1 : 0) };
    })
    .filter(result => result.score > 0 && (!needSharedWord || result.shared > 0))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(result => result.post);
}

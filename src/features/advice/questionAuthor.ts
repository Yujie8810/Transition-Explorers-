import type { PostedQuestion } from './AdviceProvider';

// Use the same author label on question cards and details.
export function questionAuthorLabel(question: Pick<PostedQuestion, 'visibility' | 'isMine' | 'authorName'>) {
  if (question.isMine) {
    return question.visibility === 'Anonymous' ? 'Posted by you · anonymous' : 'Posted by you';
  }
  if (question.visibility === 'Anonymous') return 'Posted anonymously';
  return `Posted by ${question.authorName?.trim() || 'Community member'}`;
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { sampleAdvice } from '../../data/sampleData';
import { Advice, Topic } from '../../types';

/**
 * Owner: Mourede.
 * Shares the questions the user posts with every advice screen (Explore feed,
 * advice detail, Ask) and keeps them on the device between app restarts.
 */

export type Visibility = 'Public' | 'Anonymous';
// followUpOf links a follow-up to the question it continues (DP3 issue #12).
export type QuestionDraft = { title: string; body: string; topic: Topic; visibility: Visibility; followUpOf?: string };
export type PostedQuestion = Advice & { visibility: Visibility; postedAt: string; followUpOf?: string };

type AdviceContextValue = {
  posts: Advice[];
  findPost: (id: string) => Advice | undefined;
  postQuestion: (draft: QuestionDraft) => Promise<PostedQuestion>;
};

const storageKey = 'transition-explorers.advice.v1';
const AdviceContext = createContext<AdviceContextValue | null>(null);

export const isPostedQuestion = (post: Advice): post is PostedQuestion => 'visibility' in post;

function readSaved(raw: string | null): PostedQuestion[] {
  const saved = raw ? JSON.parse(raw) : [];
  return Array.isArray(saved)
    ? saved.filter(q => q && typeof q.id === 'string' && typeof q.title === 'string' && typeof q.body === 'string')
    : [];
}

export function AdviceProvider({ children }: { children: ReactNode }) {
  const [posted, setPosted] = useState<PostedQuestion[]>([]);
  const current = useRef(posted);
  const loading = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    loading.current = AsyncStorage.getItem(storageKey)
      .then(raw => { current.current = readSaved(raw); setPosted(current.current); })
      .catch(() => {}); // Start with no posted questions if saved data cannot be read.
  }, []);

  // The user's own questions come first, newest at the top.
  const posts = [...posted, ...sampleAdvice];

  const postQuestion = async (draft: QuestionDraft) => {
    await loading.current; // Never overwrite saved questions that have not loaded yet.
    const question: PostedQuestion = {
      ...draft, title: draft.title.trim(), body: draft.body.trim(), authorId: 'you',
      id: `q-${Date.now()}`, postedAt: new Date().toISOString(),
    };
    const next = [question, ...current.current];
    await AsyncStorage.setItem(storageKey, JSON.stringify(next));
    current.current = next;
    setPosted(next);
    return question;
  };

  return <AdviceContext.Provider value={{
    posts, postQuestion, findPost: id => posts.find(post => post.id === id),
  }}>{children}</AdviceContext.Provider>;
}

export function useAdvice() {
  const context = useContext(AdviceContext);
  if (!context) throw new Error('useAdvice requires AdviceProvider');
  return context;
}

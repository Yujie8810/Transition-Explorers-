import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { sampleAdvice } from '../../data/sampleData';
import { Advice, Topic } from '../../types';

/** Shares locally posted questions across Explore, Ask, details, and Profile.
 * need to implment: auth owners, scope storage and ownership to the signed-in user.
 * Until authentication is connected, 'you' identifies this device's demo user.
 */
export type Visibility = 'Public' | 'Anonymous';
export type QuestionDraft = { title: string; body: string; topic: Topic; visibility: Visibility; followUpOf?: string };
export type PostedQuestion = Advice & { visibility: Visibility; postedAt: string; followUpOf?: string };
export const questionRules = { titleMin: 10, titleMax: 150, bodyMax: 1000 };

type AdviceContextValue = {
  posts: Advice[];
  postedQuestions: PostedQuestion[];
  ready: boolean;
  loadError: string;
  reload: () => void;
  findPost: (id: string) => Advice | undefined;
  postQuestion: (draft: QuestionDraft) => Promise<PostedQuestion>;
  updateQuestion: (id: string, draft: QuestionDraft) => Promise<void>;
  deleteQuestion: (id: string) => Promise<void>;
};

const storageKey = 'transition-explorers.advice.v1';
const AdviceContext = createContext<AdviceContextValue | null>(null);
export const isPostedQuestion = (post: Advice): post is PostedQuestion => 'visibility' in post;

function readSaved(raw: string | null): PostedQuestion[] {
  const saved = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(saved) || !saved.every(q => q && typeof q.id === 'string'
    && typeof q.title === 'string' && typeof q.body === 'string' && q.authorId === 'you'
    && ['First job', 'Interviews', 'Work life'].includes(q.topic)
    && ['Public', 'Anonymous'].includes(q.visibility) && typeof q.postedAt === 'string'
    && (q.followUpOf === undefined || typeof q.followUpOf === 'string'))) {
    throw new Error('Invalid saved question data');
  }
  return saved;
}

function cleanDraft(draft: QuestionDraft): QuestionDraft {
  const title = draft.title.trim();
  const body = draft.body.trim();
  if (title.length < questionRules.titleMin || title.length > questionRules.titleMax) {
    throw new Error(`Use ${questionRules.titleMin}–${questionRules.titleMax} characters for your question.`);
  }
  if (body.length > questionRules.bodyMax || !['First job', 'Interviews', 'Work life'].includes(draft.topic)
    || !['Public', 'Anonymous'].includes(draft.visibility)) throw new Error('Check the question details, topic, and visibility.');
  return { title, body, topic: draft.topic, visibility: draft.visibility,
    ...(draft.followUpOf ? { followUpOf: draft.followUpOf } : {}) };
}

export function AdviceProvider({ children }: { children: ReactNode }) {
  const [posted, setPosted] = useState<PostedQuestion[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const current = useRef(posted);
  const loaded = useRef(false);
  const loading = useRef<Promise<void>>(Promise.resolve());
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    loaded.current = false; setReady(false); setLoadError('');
    loading.current = AsyncStorage.getItem(storageKey).then(raw => {
      const questions = readSaved(raw);
      if (active) { current.current = questions; setPosted(questions); loaded.current = true; setReady(true); }
    }).catch(() => {
      if (active) setLoadError('Your questions could not be loaded. Retry before making changes.');
    });
    return () => { active = false; };
  }, [attempt]);

  // Serialize writes so posting/editing/deleting never overwrite a concurrent change.
  const update = (change: (questions: PostedQuestion[]) => PostedQuestion[]) => {
    const task = queue.current.then(async () => {
      await loading.current;
      if (!loaded.current) throw new Error('Your questions could not be loaded. Please retry.');
      const next = change(current.current);
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      current.current = next;
      setPosted(next);
    });
    queue.current = task.catch(() => {});
    return task;
  };

  const postQuestion = async (draft: QuestionDraft) => {
    const question: PostedQuestion = { ...cleanDraft(draft), authorId: 'you',
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2)}`, postedAt: new Date().toISOString() };
    await update(previous => [question, ...previous]);
    return question;
  };

  const ensureOwned = (questions: PostedQuestion[], id: string) => {
    if (!questions.some(q => q.id === id && q.authorId === 'you')) {
      throw new Error('This question is no longer available to edit or delete.');
    }
  };
  const updateQuestion = (id: string, draft: QuestionDraft) => update(previous => {
    ensureOwned(previous, id);
    const clean = cleanDraft(draft);
    // Keep the original identity, creation date, and follow-up relationship.
    return previous.map(q => q.id === id ? { ...q, title: clean.title, body: clean.body,
      topic: clean.topic, visibility: clean.visibility } : q);
  });
  const deleteQuestion = (id: string) => update(previous => {
    ensureOwned(previous, id);
    // Follow-ups remain independent questions after the original is removed.
    return previous.filter(q => q.id !== id).map(q => {
      if (q.followUpOf !== id) return q;
      const { followUpOf, ...independent } = q;
      return independent;
    });
  });
  const posts = [...posted, ...sampleAdvice];
  return <AdviceContext.Provider value={{ posts, postedQuestions: posted, ready, loadError,
    reload: () => setAttempt(value => value + 1), postQuestion, updateQuestion, deleteQuestion,
    findPost: id => posts.find(post => post.id === id) }}>
    {children}
  </AdviceContext.Provider>;
}

export function useAdvice() {
  const context = useContext(AdviceContext);
  if (!context) throw new Error('useAdvice requires AdviceProvider');
  return context;
}

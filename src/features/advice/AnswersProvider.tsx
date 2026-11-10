import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import { sampleAnswers, sampleGuides } from '../../data/sampleData';
import type { Answer, Guide } from '../../types';
import { createAnswer, fetchAnswerFeed } from './adviceApi';

type AnswerRow = {
  id: string;
  question_id: string;
  author_id: string;
  body: string;
  author: {
    id: string;
    full_name: string | null;
    current_role: string | null;
    graduation_year: number | null;
  } | null;
};

type AnswersContextValue = {
  ready: boolean;
  loadError: string;
  reload: () => void;
  answersFor: (questionId: string) => Answer[];
  findAnswer: (answerId: string) => Answer | undefined;
  findGuide: (authorId: string) => Guide | undefined;
  postAnswer: (questionId: string, body: string) => Promise<void>;
};

const AnswersContext = createContext<AnswersContextValue | null>(null);

export function AnswersProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [remoteAnswers, setRemoteAnswers] = useState<Answer[]>([]);
  const [remoteGuides, setRemoteGuides] = useState<Guide[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const reload = () => {
    setAttempt(value => value + 1);
  };

  useEffect(() => {
    let active = true;

    setReady(false);
    setLoadError('');

    fetchAnswerFeed()
      .then(data => {
        const rows = data as unknown as AnswerRow[];

        // Convert database fields into the app's answer type.
        const answers: Answer[] = rows.map(row => ({
          id: row.id,
          adviceId: row.question_id,
          guideId: row.author_id,
          body: row.body,
        }));

        // Keep one author entry per profile.
        const guides = new Map<string, Guide>();

        for (const row of rows) {
          guides.set(row.author_id, {
            id: row.author_id,
            name: row.author?.full_name?.trim() || 'Community member',
            role: row.author?.current_role || 'UTD community',
            expertise: [],
            ...(row.author?.graduation_year != null
              ? { gradYear: row.author.graduation_year }
              : {}),
          });
        }

        // Ignore results after logout or an account change.
        if (active) {
          setRemoteAnswers(answers);
          setRemoteGuides([...guides.values()]);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError('Answers could not be loaded. Please retry.');
        }
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  const postAnswer = async (questionId: string, body: string) => {
    const clean = body.trim();

    if (!ready) {
      throw new Error('Wait for answers to load.');
    }

    if (!clean || clean.length > 5000) {
      throw new Error('Write an answer using 1–5000 characters.');
    }

    // Only report success after the database accepts the answer.
    await createAnswer(questionId, clean);

    // Refresh separately so a reload failure does not imply posting failed.
    reload();
  };

  // Keep the fictional examples while introducing real content.
  const answers = [...remoteAnswers, ...sampleAnswers];
  const guides = [...remoteGuides, ...sampleGuides];

  return (
    <AnswersContext.Provider
      value={{
        ready,
        loadError,
        reload,
        postAnswer,
        answersFor: questionId =>
          answers.filter(answer => answer.adviceId === questionId),
        findAnswer: answerId =>
          answers.find(answer => answer.id === answerId),
        findGuide: authorId =>
          guides.find(guide => guide.id === authorId),
      }}
    >
      {children}
    </AnswersContext.Provider>
  );
}

export function useAnswers() {
  const context = useContext(AnswersContext);

  if (!context) {
    throw new Error('useAnswers requires AnswersProvider');
  }

  return context;
}
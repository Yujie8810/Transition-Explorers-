import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import { sampleAdvice } from '../../data/sampleData';
import { Advice, Topic } from '../../types';
import {
  createQuestion,
  editQuestion,
  fetchQuestions,
  removeQuestion,
  type QuestionRow,
} from './adviceApi';

export type Visibility = 'Public' | 'Anonymous';

export type QuestionDraft = {
  title: string;
  body: string;
  topic: Topic;
  visibility: Visibility;
  followUpOf?: string;
};

export type PostedQuestion = Advice & {
  visibility: Visibility;
  postedAt: string;
  followUpOf?: string;
  isMine: boolean;
  authorName?: string | null;
};

export const questionRules = {
  titleMin: 10,
  titleMax: 150,
  bodyMax: 1000,
};

type AdviceContextValue = {
  posts: Advice[];
  postedQuestions: PostedQuestion[];
  ready: boolean;
  loadError: string;
  reload: () => void;
  findPost: (id: string) => Advice | undefined;
  postQuestion: (draft: QuestionDraft) => Promise<PostedQuestion>;
  updateQuestion: (
    id: string,
    draft: QuestionDraft,
  ) => Promise<void>;
  deleteQuestion: (id: string) => Promise<void>;
};

const AdviceContext = createContext<AdviceContextValue | null>(null);

// Identify a database question, including other users' questions.
export const isPostedQuestion = (
  post: Advice,
): post is PostedQuestion => 'visibility' in post;

// Check ownership separately from the question's source.
export const isOwnQuestion = (
  post: Advice,
): post is PostedQuestion =>
  isPostedQuestion(post) && post.isMine;

// Convert database column names into the app's field names.
function mapQuestion(row: QuestionRow): PostedQuestion {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    topic: row.topic,
    authorId: row.author_id ?? 'anonymous',
    authorName: row.visibility === 'Public' ? row.author_name : null,
    visibility: row.visibility,
    postedAt: row.created_at,
    isMine: row.is_mine,
    ...(row.follow_up_of
      ? { followUpOf: row.follow_up_of }
      : {}),
  };
}

// Validate the question before sending it.
function cleanDraft(draft: QuestionDraft): QuestionDraft {
  const title = draft.title.trim();
  const body = draft.body.trim();

  if (
    title.length < questionRules.titleMin ||
    title.length > questionRules.titleMax
  ) {
    throw new Error('Use 10-150 characters for your question.');
  }

  if (body.length > questionRules.bodyMax) {
    throw new Error('Keep question details within 1000 characters.');
  }

  if (
    !['First job', 'Interviews', 'Work life'].includes(draft.topic)
  ) {
    throw new Error('Select a topic.');
  }

  if (!['Public', 'Anonymous'].includes(draft.visibility)) {
    throw new Error('Select a visibility option.');
  }

  // Old fictional questions have text IDs, not database UUIDs.
  if (
    draft.followUpOf &&
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(
      draft.followUpOf,
    )
  ) {
    throw new Error(
      'Follow-ups currently work only for questions posted to the database.',
    );
  }

  return { ...draft, title, body };
}

export function AdviceProvider({
  children,
  accountId,
}: {
  children: ReactNode;
  accountId: string;
}) {
  const [questions, setQuestions] = useState<PostedQuestion[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const reload = () => {
    setAttempt(value => value + 1);
  };

  // Load questions when the account changes or reload is requested.
  useEffect(() => {
    let active = true;

    setReady(false);
    setLoadError('');

    fetchQuestions()
      .then(data => {
        const next = data.map(mapQuestion);

        // Ignore a response if this provider has been unmounted.
        if (active) {
          setQuestions(next);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError(
            'Questions could not be loaded. Check your connection and retry.',
          );
        }
      });

    return () => {
      active = false;
    };
  }, [accountId, attempt]);

  const requireReady = () => {
    if (!ready) {
      throw new Error('Wait for your questions to load.');
    }
  };

  // This improves UI feedback; database RLS still enforces ownership.
  const ensureOwned = (id: string) => {
    requireReady();

    if (!questions.some(question => question.id === id && question.isMine)) {
      throw new Error(
        'This question is unavailable or does not belong to you.',
      );
    }
  };

  const postQuestion = async (
    draft: QuestionDraft,
  ): Promise<PostedQuestion> => {
    requireReady();

    const clean = cleanDraft(draft);
    const id = await createQuestion(clean);

    // Show the committed post immediately.
    // Reload then supplies its server-generated timestamp.
    const question: PostedQuestion = {
      ...clean,
      id,
      authorId:
        clean.visibility === 'Anonymous' ? 'anonymous' : accountId,
      postedAt: new Date().toISOString(),
      isMine: true,
    };

    setQuestions(previous => [question, ...previous]);
    reload();

    return question;
  };

  const updateQuestion = async (
    id: string,
    draft: QuestionDraft,
  ) => {
    ensureOwned(id);

    const clean = cleanDraft(draft);
    await editQuestion(id, clean);

    // Update the screen only after the database accepts the edit.
    setQuestions(previous =>
      previous.map(question =>
        question.id === id
          ? {
              ...question,
              title: clean.title,
              body: clean.body,
              topic: clean.topic,
              visibility: clean.visibility,
              authorName: clean.visibility === 'Anonymous' ? null : question.authorName,
              authorId:
                clean.visibility === 'Anonymous'
                  ? 'anonymous'
                  : accountId,
            }
          : question,
      ),
    );

    reload();
  };

  const deleteQuestion = async (id: string) => {
    ensureOwned(id);
    await removeQuestion(id);

    // Keep follow-ups as independent questions.
    setQuestions(previous =>
      previous
        .filter(question => question.id !== id)
        .map(question =>
          question.followUpOf === id
            ? { ...question, followUpOf: undefined }
            : question,
        ),
    );

    reload();
  };

  // Keep fictional examples while database content is being introduced.
  const posts: Advice[] = [...questions, ...sampleAdvice];

  // Profile should list only this account's questions.
  const postedQuestions = questions.filter(question => question.isMine);

  return (
    <AdviceContext.Provider
      value={{
        posts,
        postedQuestions,
        ready,
        loadError,
        reload,
        postQuestion,
        updateQuestion,
        deleteQuestion,
        findPost: id => posts.find(post => post.id === id),
      }}
    >
      {children}
    </AdviceContext.Provider>
  );
}

export function useAdvice() {
  const context = useContext(AdviceContext);

  if (!context) {
    throw new Error('useAdvice requires AdviceProvider');
  }

  return context;
}

import {supabase} from '../../lib/supabase';
import type {QuestionDraft, Visibility} from './AdviceProvider';
import type {Topic} from '../../types';

export type QuestionRow = {
    id: string;
    title: string;
    body: string;
    topic: Topic;
    visibility: Visibility;
    created_at: string;
    follow_up_of: string | null;
    author_id: string | null;
    is_mine: boolean;
    author_name: string | null;
};

//get the configured supabase client, or throw an error if it is not configured
function getClient(){
    if(!supabase){
        throw new Error('Supabase client is not configured. Make sure to set the EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variables.');
    }
    return supabase;
}

//load question without exposing anonymous authors
export async function fetchQuestions(){
    const {data, error} = await getClient().rpc('get_question_feed');

    if(error){
        throw new Error(`Failed to fetch questions: ${error.message}`);
    }

    const questions = (data ?? []) as QuestionRow[];

    // Fetch public authors together instead of making a request for every card.
    const authorIds = [...new Set(questions
        .filter(question => question.visibility === 'Public' && question.author_id)
        .map(question => question.author_id as string))];

    const names = new Map<string, string | null>();
    if (authorIds.length) {
        const {data: profiles, error: profileError} = await getClient()
            .from('Profiles')
            .select('id, full_name')
            .in('id', authorIds);

        if (profileError) throw new Error(`Failed to fetch question authors: ${profileError.message}`);
        for (const profile of profiles ?? []) {
            names.set(profile.id, profile.full_name);
        }
    }

    return questions.map(question => ({
        ...question,
        // Never attach a profile name or ID to an anonymous feed entry.
        author_id: question.visibility === 'Public' ? question.author_id : null,
        author_name: question.visibility === 'Public' && question.author_id
            ? names.get(question.author_id)?.trim() || null
            : null,
    }));
}

//create a question and return its id
export async function createQuestion(draft: QuestionDraft){
    const {data, error} = await getClient()
    .from('questions')
    .insert({
        title: draft.title.trim(),
        body: draft.body.trim(),
        topic: draft.topic,
        visibility: draft.visibility,
        follow_up_of: draft.followUpOf ?? null
    })
    .select('id')
    .single();

    if(error) throw error;
    return data.id as string;
}

//edit a question without changing its author or creation date
export async function editQuestion(
    id: string,
    draft: QuestionDraft
) {
    const {data, error} = await getClient()
        .from('questions')
        .update({
            title: draft.title.trim(),
            body: draft.body.trim(),
            topic: draft.topic,
            visibility: draft.visibility,
        })
        .eq('id', id)
        .select('id')
        .single();

    if(error) throw error;
    return data.id as string;
}

//delete a question
export async function removeQuestion(id: string){
    const {error} = await getClient()
        .from('questions')
        .delete()
        .eq('id', id)
        .select('id')
        .single();

    if(error) throw error;
}

//load answers for a question, oldest first
export async function fetchAnswers(questionId: string){
    const {data, error} = await getClient()
        .from('answers')
        .select('id, question_id, author_id, body, created_at')
        .eq('question_id', questionId)
        .order('created_at');

    if(error) throw new Error(`Failed to fetch answers: ${error.message}`);
    return data ?? [];
}

//post an answer to a question
export async function createAnswer(
    questionId: string,
    body: string
) {
    const {error} = await getClient()
        .from('answers')
        .insert({
            question_id: questionId,
            body: body.trim()
        });

    if(error) throw error;
}

export type SavedAnswerRow = {
    answer_id: string;
    created_at: string;
    answers: { question_id: string };
};

// Load saves and the question each answer belongs to.
export async function fetchSavedAnswers() {
    const {data, error} = await getClient()
        .from('saved_answers')
        .select('answer_id, created_at, answers!inner(question_id)')
        .order('created_at', {ascending: false});

    // RLS returns only the current user's saves.
    if(error) throw error;
    return (data ?? []) as unknown as SavedAnswerRow[];
}

// Bind the save to the account that started the action.
export async function saveAnswer(answerId: string, accountId: string) {
    const {error} = await getClient()
        .from('saved_answers')
        .upsert({user_id: accountId, answer_id: answerId}, {
            onConflict: 'user_id,answer_id',
            ignoreDuplicates: true,
        });

    // RLS rejects attempts to save for a different signed-in user.
    if(error) throw error;
}

// Remove only this account's save.
export async function unsaveAnswer(answerId: string, accountId: string) {
    const {error} = await getClient()
        .from('saved_answers')
        .delete()
        .eq('user_id', accountId)
        .eq('answer_id', answerId);

    if(error) throw error;
}

// Load database answers and their authors.
export async function fetchAnswerFeed() {
  const { data, error } = await getClient()
    .from('answers')
    .select(`
      id,
      question_id,
      author_id,
      body,
      author:Profiles!answers_author_id_fkey(
        id,
        full_name,
        current_role,
        graduation_year
      )
    `)
    .order('created_at');

  if (error) throw error;
  return data ?? [];
}
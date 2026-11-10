import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '../../state/ProfileContext';

export type Account = { id: string; email: string; initialProfile: UserProfile };
export type Registration = UserProfile & { email: string; password: string };
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const validEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function validateRegistration(input: Registration): Registration {
  const clean = { ...input, email: normalizeEmail(input.email), name: input.name.trim(), program: input.program.trim() };
  if (!clean.name || clean.name.length > 80) throw new Error('Enter a name using 1–80 characters.');
  if (!validEmail(clean.email)) throw new Error('Enter a valid email address.');
  if (typeof clean.password !== 'string' || clean.password.length < 8) throw new Error('Use a password with at least 8 characters.');
  if (!clean.program || clean.program.length > 100) throw new Error('Enter a program or field of study using 1–100 characters.');
  if (!['Student', 'Graduate'].includes(clean.affiliation)) throw new Error('Select Student or Graduate.');
  return clean;
}

export function accountFromUser(user: User): Account {
  const data = user.user_metadata ?? {};
  return { id: user.id, email: user.email ?? '', initialProfile: {
    name: typeof data.full_name === 'string' ? data.full_name : '',
    program: typeof data.major === 'string' ? data.major : '',
    affiliation: data.affiliation === 'Graduate' ? 'Graduate' : 'Student',
  } };
}

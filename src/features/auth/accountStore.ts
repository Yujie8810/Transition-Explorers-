import type { UserProfile } from '../../state/ProfileContext';

export type DemoAccount = { id: string; email: string; initialProfile: UserProfile };
export type Registration = UserProfile & { email: string };
type AccountData = { accounts: DemoAccount[]; activeId: string | null };
type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };

export const accountStorageKey = 'transition-explorers.demo-accounts.v1';
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const validEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function validateRegistration(input: Registration): Registration {
  const clean = { ...input, email: normalizeEmail(input.email), name: input.name.trim(), program: input.program.trim() };
  if (!clean.name || clean.name.length > 80) throw new Error('Enter a name using 1–80 characters.');
  if (!validEmail(clean.email)) throw new Error('Enter a valid email address.');
  if (!clean.program || clean.program.length > 100) throw new Error('Enter a program or field of study using 1–100 characters.');
  if (!['Student', 'Graduate'].includes(clean.affiliation)) throw new Error('Select Student or Graduate.');
  return clean;
}

function readData(raw: string | null): AccountData {
  if (raw === null) return { accounts: [], activeId: null };
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data.accounts) || !(data.activeId === null || typeof data.activeId === 'string')) {
    throw new Error('Invalid account storage');
  }
  const ids = new Set<string>();
  const emails = new Set<string>();
  for (const account of data.accounts) {
    if (!account || typeof account.id !== 'string' || !/^local-[a-z0-9-]+$/.test(account.id)
      || typeof account.email !== 'string' || !account.initialProfile
      || typeof account.initialProfile.name !== 'string' || typeof account.initialProfile.program !== 'string') {
      throw new Error('Invalid account storage');
    }
    const clean = validateRegistration({ ...account.initialProfile, email: account.email });
    if (clean.email !== account.email || ids.has(account.id) || emails.has(account.email)) throw new Error('Invalid account storage');
    ids.add(account.id); emails.add(account.email);
  }
  if (data.activeId !== null && !ids.has(data.activeId)) throw new Error('Invalid saved session');
  return data;
}

// A local demo identity selector, not a credential verifier. Keep accounts and
// session in one write so a failed signup/logout never reports partial success.
export function createAccountStore(storage: Storage) {
  let current: AccountData | undefined;
  let loading: Promise<AccountData> | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  const load = async (): Promise<AccountData> => {
    if (current) return current;
    if (!loading) loading = storage.getItem(accountStorageKey).then(raw => {
      current = readData(raw);
      return current;
    }).catch(error => { loading = undefined; throw error; });
    return loading;
  };
  const session = (data: AccountData) => data.accounts.find(account => account.id === data.activeId) ?? null;
  const update = (change: (data: AccountData) => AccountData) => {
    const task = queue.then(async () => {
      const next = change(await load());
      try { await storage.setItem(accountStorageKey, JSON.stringify(next)); }
      catch { throw new Error('Your changes could not be saved. Please try again.'); }
      current = next;
      return session(next);
    });
    queue = task.catch(() => {});
    return task;
  };
  return {
    restore: async () => session(await load()),
    signUp: (input: Registration) => update(data => {
      const { email, ...initialProfile } = validateRegistration(input);
      if (data.accounts.some(account => account.email === email)) {
        throw new Error('An account with this email already exists. Log in instead.');
      }
      const account: DemoAccount = { id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, email, initialProfile };
      return { accounts: [...data.accounts, account], activeId: account.id };
    }),
    signIn: (input: string) => update(data => {
      const email = normalizeEmail(input);
      if (!validEmail(email)) throw new Error('Enter a valid email address.');
      const account = data.accounts.find(item => item.email === email);
      if (!account) throw new Error('No account found with this email. Sign up to get started.');
      return { ...data, activeId: account.id };
    }),
    signOut: () => update(data => ({ ...data, activeId: null })),
  };
}

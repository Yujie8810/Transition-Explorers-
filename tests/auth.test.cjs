const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { exports: module.exports, require(name) {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected import: ${name}`);
  }});
  return module.exports;
}

const { createAccountStore, accountStorageKey } = load('src/features/auth/accountStore.ts');
const registration = (email = 'aproteem@example.test') => ({
  email, name: 'Aproteem', program: 'Computer Science', affiliation: 'Student',
});
function storage(entries = {}) {
  return {
    data: new Map(Object.entries(entries)), failRead: false, failWrite: false,
    async getItem(key) { if (this.failRead) throw new Error('Unavailable'); return this.data.get(key) ?? null; },
    async setItem(key, value) { if (this.failWrite) throw new Error('Full'); this.data.set(key, value); },
  };
}

test('signup normalizes identity and restores the same session after restart', async () => {
  const disk = storage();
  const store = createAccountStore(disk);
  assert.equal(await store.restore(), null);
  const account = await store.signUp({ ...registration(' APROTEEM@example.test '), name: ' Aproteem ' });
  assert.equal(account.email, 'aproteem@example.test');
  assert.equal(account.initialProfile.name, 'Aproteem');
  const restored = await createAccountStore(disk).restore();
  assert.equal(restored.id, account.id);
  await store.signOut();
  assert.equal(await createAccountStore(disk).restore(), null);
  assert.equal((await store.signIn(' APROTEEM@example.test ')).id, account.id);
});

test('invalid registration, duplicate emails, and unknown logins do not change the session', async () => {
  const disk = storage(); const store = createAccountStore(disk);
  for (const invalid of [{ name: ' ' }, { email: 'bad' }, { program: '' }, { affiliation: 'Visitor' }]) {
    await assert.rejects(store.signUp({ ...registration(), ...invalid }));
    assert.equal(disk.data.size, 0);
  }
  const account = await store.signUp(registration());
  await assert.rejects(store.signUp(registration('APROTEEM@example.test')), /already exists/);
  await assert.rejects(store.signIn('missing@example.test'), /Sign up/);
  assert.equal((await store.restore()).id, account.id);
});

test('concurrent duplicate signup creates exactly one account', async () => {
  const disk = storage(); const store = createAccountStore(disk);
  const results = await Promise.allSettled([store.signUp(registration()), store.signUp(registration())]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(JSON.parse(disk.data.get(accountStorageKey)).accounts.length, 1);
});

test('failed signup, login, and logout writes preserve the last committed session and allow retry', async () => {
  const disk = storage(); const store = createAccountStore(disk);
  disk.failWrite = true;
  await assert.rejects(store.signUp(registration()), /could not be saved/);
  assert.equal(await store.restore(), null);
  disk.failWrite = false;
  const account = await store.signUp(registration());
  disk.failWrite = true;
  await assert.rejects(store.signOut(), /could not be saved/);
  assert.equal((await createAccountStore(disk).restore()).id, account.id);
  disk.failWrite = false;
  await store.signOut();
  disk.failWrite = true;
  await assert.rejects(store.signIn(account.email), /could not be saved/);
  assert.equal(await store.restore(), null);
  disk.failWrite = false;
  assert.equal((await store.signIn(account.email)).id, account.id);
});

test('unreadable or corrupt account data blocks writes and can be retried without erasing data', async () => {
  const disk = storage({ [accountStorageKey]: '{broken' }); const store = createAccountStore(disk);
  await assert.rejects(store.restore());
  await assert.rejects(store.signUp(registration()));
  assert.equal(disk.data.get(accountStorageKey), '{broken');
  disk.data.delete(accountStorageKey);
  disk.failRead = true;
  await assert.rejects(store.restore());
  disk.failRead = false;
  assert.equal(await store.restore(), null);
  await store.signUp(registration());
});

// Exercise the real personal-data providers with controllable storage across
// account remounts. Seed legacy keys to catch accidental migration/leakage.
function mountProvider(file, exportName, disk, accountId, initialProfile = registration()) {
  const slots = []; const effects = [];
  let cursor = 0;
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => value !== slots[index][i])) effects.push(effect);
      slots[index] = deps;
    },
  };
  const jsx = (type, props) => ({ type, props });
  const exports = load(file, {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    '@react-native-async-storage/async-storage': { __esModule: true, default: disk },
    '../../data/sampleData': { sampleAdvice: [], sampleGuides: [{ id: 'taylor' }] },
  });
  const render = () => {
    cursor = 0;
    const value = exports[exportName]({ accountId, initialProfile, children: null }).props.value;
    effects.splice(0).forEach(effect => effect());
    return value;
  };
  return { render, async ready() { render(); await new Promise(setImmediate); return render(); } };
}

test('all four providers isolate accounts, restore edits, and leave legacy device data untouched', async () => {
  const disk = storage({
    'transition-explorers.profile.v1': JSON.stringify({ name: 'Legacy user', affiliation: 'Graduate', program: 'Legacy' }),
    'transition-explorers.advice.v1': '["legacy questions"]',
    'transition-explorers.network.v1': '{"legacy":true}',
    'transition-explorers.saved-advice.v1': '[{"answerId":"legacy","adviceId":"legacy","savedAt":"legacy"}]',
  });
  const legacy = [...disk.data.entries()];
  const modules = [
    ['src/state/ProfileContext.tsx', 'ProfileProvider',
      value => value.updateProfile({ name: 'Edited Aproteem', program: 'Software Engineering', affiliation: 'Graduate' }),
      value => value.profile.name, 'Edited Aproteem', 'Account B'],
    ['src/features/advice/AdviceProvider.tsx', 'AdviceProvider',
      value => value.postQuestion({ title: 'How do I start my first job?', body: '', topic: 'First job', visibility: 'Public' }),
      value => value.postedQuestions.length, 1, 0],
    ['src/features/network/NetworkProvider.tsx', 'NetworkProvider',
      value => value.saveRequest({ guideId: 'taylor', message: 'Help please', kind: 'advice' }),
      value => value.requests.length, 1, 0],
    ['src/state/SavedAdviceContext.tsx', 'SavedAdviceProvider',
      value => value.saveAdvice('answer-a', 'question-a'),
      value => value.saved.length, 1, 0],
  ];
  for (const [file, provider, change, select, expectedA, expectedB] of modules) {
    const accountA = mountProvider(file, provider, disk, 'local-a');
    await change(await accountA.ready());
    const accountB = await mountProvider(file, provider, disk, 'local-b', { ...registration(), name: 'Account B' }).ready();
    assert.equal(select(accountB), expectedB, `${provider}: account B must start independently`);
    const restoredA = await mountProvider(file, provider, disk, 'local-a').ready();
    assert.equal(select(restoredA), expectedA, `${provider}: account A must retain its data`);
  }
  for (const [key, value] of legacy) assert.equal(disk.data.get(key), value);
});

test('writes finishing after an account switch remain in the original account namespace', async () => {
  const disk = storage();
  const accountA = mountProvider('src/features/advice/AdviceProvider.tsx', 'AdviceProvider', disk, 'local-a');
  const adviceA = await accountA.ready();
  const originalWrite = disk.setItem.bind(disk);
  let release;
  disk.setItem = async (key, value) => {
    await new Promise(resolve => { release = resolve; });
    await originalWrite(key, value);
  };
  const pending = adviceA.postQuestion({ title: 'Question from account A', body: '', topic: 'First job', visibility: 'Public' });
  await new Promise(setImmediate);
  const accountB = mountProvider('src/features/advice/AdviceProvider.tsx', 'AdviceProvider', disk, 'local-b');
  assert.equal((await accountB.ready()).postedQuestions.length, 0);
  release(); await pending;
  assert.equal(accountB.render().postedQuestions.length, 0);
  assert.equal(JSON.parse(disk.data.get('transition-explorers.advice.v1.local-a')).length, 1);
  assert.equal(disk.data.has('transition-explorers.advice.v1.local-b'), false);
});

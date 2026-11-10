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

const { accountFromUser, validateRegistration } = load('src/features/auth/accountStore.ts');
const registration = (email = 'aproteem@example.test') => ({
  email, password: 'test-password', name: 'Aproteem', program: 'Computer Science', affiliation: 'Student',
});
function storage(entries = {}) {
  return {
    data: new Map(Object.entries(entries)), failRead: false, failWrite: false,
    async getItem(key) { if (this.failRead) throw new Error('Unavailable'); return this.data.get(key) ?? null; },
    async setItem(key, value) { if (this.failWrite) throw new Error('Full'); this.data.set(key, value); },
  };
}

test('registration normalizes identity and rejects missing credentials or profile fields', () => {
  const result = validateRegistration({ ...registration(' APROTEEM@example.test '), name: ' Aproteem ' });
  assert.equal(result.email, 'aproteem@example.test');
  assert.equal(result.name, 'Aproteem');
  assert.equal(result.password, 'test-password');
  for (const invalid of [{ name: ' ' }, { email: 'bad' }, { password: '' }, { password: 'short' }, { program: '' }, { affiliation: 'Visitor' }]) {
    assert.throws(() => validateRegistration({ ...registration(), ...invalid }));
  }
});

test('Supabase user mapping preserves the server-issued ID and never uses a local identity', () => {
  const account = accountFromUser({ id: 'server-uuid', email: 'person@example.test',
    user_metadata: { full_name: 'Person', major: 'CS', affiliation: 'Graduate' } });
  assert.equal(account.id, 'server-uuid');
  assert.equal(account.initialProfile.affiliation, 'Graduate');
});

// Exercise the remaining local Circle provider with controllable storage across
// account remounts. Seed legacy keys to catch accidental migration/leakage.
function mountProvider(file, exportName, disk, accountId, api = {}) {
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
    './adviceApi': api,
  });
  const render = () => {
    cursor = 0;
    const value = exports[exportName]({ accountId, children: null }).props.value;
    effects.splice(0).forEach(effect => effect());
    return value;
  };
  return { render, async ready() { render(); await new Promise(setImmediate); return render(); } };
}

test('local Circle data isolates accounts, restores requests, and leaves legacy device data untouched', async () => {
  const disk = storage({
    'transition-explorers.profile.v1': JSON.stringify({ name: 'Legacy user', affiliation: 'Graduate', program: 'Legacy' }),
    'transition-explorers.advice.v1': '["legacy questions"]',
    'transition-explorers.network.v1': '{"legacy":true}',
    'transition-explorers.saved-advice.v1': '[{"answerId":"legacy","adviceId":"legacy","savedAt":"legacy"}]',
  });
  const legacy = [...disk.data.entries()];
  const modules = [
    ['src/features/network/NetworkProvider.tsx', 'NetworkProvider',
      value => value.saveRequest({ guideId: 'taylor', message: 'Help please', kind: 'advice' }),
      value => value.requests.length, 1, 0],
  ];
  for (const [file, provider, change, select, expectedA, expectedB] of modules) {
    const accountA = mountProvider(file, provider, disk, 'local-a');
    await change(await accountA.ready());
    const accountB = await mountProvider(file, provider, disk, 'local-b').ready();
    assert.equal(select(accountB), expectedB, `${provider}: account B must start independently`);
    const restoredA = await mountProvider(file, provider, disk, 'local-a').ready();
    assert.equal(select(restoredA), expectedA, `${provider}: account A must retain its data`);
  }
  for (const [key, value] of legacy) assert.equal(disk.data.get(key), value);
});

test('writes finishing after an account switch remain in the original account namespace', async () => {
  const disk = storage();
  const accountA = mountProvider('src/features/network/NetworkProvider.tsx', 'NetworkProvider', disk, 'local-a');
  const networkA = await accountA.ready();
  const originalWrite = disk.setItem.bind(disk);
  let release;
  disk.setItem = async (key, value) => {
    await new Promise(resolve => { release = resolve; });
    await originalWrite(key, value);
  };
  const pending = networkA.saveRequest({ guideId: 'taylor', message: 'Request from account A', kind: 'advice' });
  await new Promise(setImmediate);
  const accountB = mountProvider('src/features/network/NetworkProvider.tsx', 'NetworkProvider', disk, 'local-b');
  assert.equal((await accountB.ready()).requests.length, 0);
  release(); await pending;
  assert.equal(accountB.render().requests.length, 0);
  assert.equal(JSON.parse(disk.data.get('transition-explorers.network.v1.local-a')).requests.length, 1);
  assert.equal(disk.data.has('transition-explorers.network.v1.local-b'), false);
});

// This fake models shared remote content for provider tests; it does not verify RLS.
test('database questions reload across mounts and expose only owned questions in Profile', async () => {
  const rows = new Map();
  const apiFor = accountId => ({
    async fetchQuestions() {
      return [...rows.values()].map(row => ({ ...row, is_mine: row.author_id === accountId }));
    },
    async createQuestion(draft) {
      const id = 'server-question';
      rows.set(id, { ...draft, id, author_id: accountId, author_name: 'Account A',
        created_at: '2026-11-10T12:00:00Z', follow_up_of: null });
      return id;
    },
    async editQuestion(id, draft) { rows.set(id, { ...rows.get(id), ...draft }); },
    async removeQuestion(id) { rows.delete(id); },
  });
  const mountQuestions = account => mountProvider('src/features/advice/AdviceProvider.tsx',
    'AdviceProvider', storage(), account, apiFor(account));
  const first = mountQuestions('account-a');
  await first.ready();
  const posted = await first.render().postQuestion({ title: 'How do I start my first job?',
    body: '', topic: 'First job', visibility: 'Public' });
  assert.equal(posted.id, 'server-question');
  const second = mountQuestions('account-a');
  const restored = await second.ready();
  assert.equal(restored.postedQuestions[0].postedAt, '2026-11-10T12:00:00Z');
  await restored.updateQuestion(posted.id, { title: 'How do I prepare for my first job?',
    body: 'Edited remotely', topic: 'First job', visibility: 'Public' });
  const other = mountQuestions('account-b');
  const otherQuestions = await other.ready();
  assert.equal(otherQuestions.posts[0].body, 'Edited remotely');
  assert.equal(otherQuestions.postedQuestions.length, 0);
  await assert.rejects(otherQuestions.deleteQuestion(posted.id), /does not belong to you/);
  await assert.rejects(otherQuestions.updateQuestion(posted.id, {}), /does not belong to you/);
  const owner = mountQuestions('account-a');
  await owner.ready();
  await owner.render().deleteQuestion(posted.id);
  assert.equal((await mountQuestions('account-a').ready()).posts.length, 0);
});

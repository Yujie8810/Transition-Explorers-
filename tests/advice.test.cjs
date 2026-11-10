const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Mock the database boundary, while exercising the real question provider.
function mount(api) {
  const slots = [], effects = [], cleanups = [];
  let cursor = 0;
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => value !== slots[index][i])) effects.push(() => {
        cleanups[index]?.(); cleanups[index] = effect();
      });
      slots[index] = deps;
    },
  };
  const jsx = (type, props) => ({ type, props });
  const imports = { react, 'react/jsx-runtime': { jsx }, './adviceApi': api,
    '../../data/sampleData': { sampleAdvice: [{ id: 'seed', title: 'Seeded question', body: '', topic: 'Work life', authorId: 'community' }] } };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('src/features/advice/AdviceProvider.tsx', 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { exports: module.exports, require(name) {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected import: ${name}`);
  }});
  const render = () => {
    cursor = 0;
    const result = module.exports.AdviceProvider({ accountId: api.owner, children: null }).props.value;
    effects.splice(0).forEach(effect => effect());
    return result;
  };
  return { render, async ready() { render(); await new Promise(setImmediate); return render(); },
    unmount() { cleanups.forEach(cleanup => cleanup?.()); } };
}
const rowId = '11111111-1111-4111-8111-111111111111';
const followId = '22222222-2222-4222-8222-222222222222';
const draft = { title: 'How do I prepare for work?', body: 'Details', topic: 'First job', visibility: 'Public' };
function backend(owner = 'account-a') {
  return { owner, rows: [], failRead: false, failWrite: false,
    async fetchQuestions() {
      if (this.failRead) throw new Error('Offline');
      return this.rows.map(row => ({ ...row, is_mine: row.owner === owner,
        author_id: row.visibility === 'Anonymous' ? null : row.owner,
        author_name: row.visibility === 'Anonymous' ? null : 'Public Author' }));
    },
    async createQuestion(input) {
      if (this.failWrite) throw new Error('Write failed');
      this.rows.push({ id: rowId, ...input, owner, follow_up_of: input.followUpOf ?? null,
        created_at: '2026-11-10T12:00:00.000Z' });
      return rowId;
    },
    async editQuestion(id, input) {
      if (this.failWrite) throw new Error('Write failed');
      this.rows = this.rows.map(row => row.id === id ? { ...row, ...input } : row);
    },
    async removeQuestion(id) {
      if (this.failWrite) throw new Error('Write failed');
      this.rows = this.rows.filter(row => row.id !== id).map(row =>
        row.follow_up_of === id ? { ...row, follow_up_of: null } : row);
    },
  };
}
// Bind methods as real imported functions, rather than relying on a receiver.
function adapter(server) {
  return { owner: server.owner, ...Object.fromEntries(['fetchQuestions', 'createQuestion', 'editQuestion', 'removeQuestion']
    .map(name => [name, server[name].bind(server)])) };
}

test('shared questions load for both accounts while posted questions include only the owner', async () => {
  const a = backend(); a.rows = [
    { id: rowId, ...draft, owner: 'account-a', created_at: '2026-11-10T12:00:00Z' },
    { id: followId, ...draft, visibility: 'Anonymous', owner: 'account-b', created_at: '2026-11-10T12:01:00Z' },
  ];
  const appA = mount(adapter(a)); const feedA = await appA.ready();
  assert.equal(feedA.posts.length, 3);
  assert.equal(feedA.postedQuestions.length, 1);
  assert.equal(feedA.findPost(rowId).authorName, 'Public Author');
  assert.equal(feedA.findPost(followId).authorId, 'anonymous');
  assert.equal(feedA.findPost(followId).authorName, null);
  const b = backend('account-b'); b.rows = a.rows;
  const appB = mount(adapter(b)); const feedB = await appB.ready();
  assert.equal(feedB.postedQuestions.length, 1);
  assert.equal(feedB.postedQuestions[0].id, followId);
  appA.unmount(); appB.unmount();
});

test('create/edit/delete use the backend and preserve independent follow-ups', async () => {
  const server = backend(), app = mount(adapter(server)); await app.ready();
  const created = await app.render().postQuestion(draft);
  assert.equal(created.id, rowId);
  assert.equal((await app.ready()).findPost(rowId).postedAt, '2026-11-10T12:00:00.000Z');
  await app.render().updateQuestion(rowId, { ...draft, title: 'How do I prepare for interviews?', visibility: 'Anonymous' });
  await app.ready();
  assert.equal(app.render().findPost(rowId).visibility, 'Anonymous');
  server.rows.push({ id: followId, ...draft, owner: server.owner, follow_up_of: rowId, created_at: '2026-11-10T12:01:00Z' });
  app.render().reload(); await app.ready();
  await app.render().deleteQuestion(rowId); await app.ready();
  assert.equal(app.render().findPost(rowId), undefined);
  assert.equal(app.render().findPost(followId).followUpOf, undefined);
  app.unmount();
});

test('failed reads support retry and failed writes never show a published question', async () => {
  const server = backend(); server.failRead = true;
  const app = mount(adapter(server));
  assert.equal((await app.ready()).ready, false);
  await assert.rejects(app.render().postQuestion(draft), /Wait/);
  server.failRead = false; app.render().reload(); await app.ready();
  server.failWrite = true;
  await assert.rejects(app.render().postQuestion(draft), /Write failed/);
  assert.equal(app.render().postedQuestions.length, 0);
  server.failWrite = false;
  await app.render().postQuestion(draft); await app.ready();
  server.failWrite = true;
  await assert.rejects(app.render().updateQuestion(rowId, draft), /Write failed/);
  await assert.rejects(app.render().deleteQuestion(rowId), /Write failed/);
  assert.equal(app.render().postedQuestions.length, 1);
  app.unmount();
});

test('other users and seeded questions cannot be edited through the provider', async () => {
  const server = backend(); server.rows = [{ id: rowId, ...draft, owner: 'account-b', created_at: '2026-11-10T12:00:00Z' }];
  const app = mount(adapter(server)); await app.ready();
  for (const id of [rowId, 'seed']) {
    await assert.rejects(app.render().updateQuestion(id, draft), /does not belong/);
    await assert.rejects(app.render().deleteQuestion(id), /does not belong/);
  }
  await assert.rejects(app.render().postQuestion({ ...draft, followUpOf: 'seed' }), /Follow-ups/);
  app.unmount();
});

test('a late feed response is ignored after the account provider unmounts', async () => {
  let release;
  const api = { owner: 'account-a', fetchQuestions: () => new Promise(resolve => { release = resolve; }) };
  const app = mount(api); app.render(); app.unmount();
  release([{ id: rowId, ...draft, author_id: 'account-a', is_mine: true }]);
  await new Promise(setImmediate);
  assert.equal(app.render().postedQuestions.length, 0);
});

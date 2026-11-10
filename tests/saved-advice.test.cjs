const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual provider with controllable storage and backend failures.
function mount(api, disk, accountId = 'account-a') {
  const slots = [], effects = [], cleanups = [];
  let cursor = 0;
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => value !== slots[index][i])) effects.push(() => {
        cleanups[index]?.(); cleanups[index] = effect();
      });
      slots[index] = deps;
    },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('src/state/SavedAdviceContext.tsx', 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const imports = {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    '@react-native-async-storage/async-storage': { __esModule: true, default: disk },
    '../data/sampleData': { sampleAnswers: [{ id: 'demo', adviceId: 'demo-question' }] },
    '../features/advice/AnswersProvider': { useAnswers: () => ({ ready: true,
      findAnswer: id => ['demo', 'real'].includes(id) ? { adviceId: `${id}-question` } : undefined }) },
    '../features/advice/adviceApi': {
      fetchSavedAnswers: () => api.read(accountId),
      saveAnswer: (id, owner) => api.save(id, owner),
      unsaveAnswer: (id, owner) => api.remove(id, owner),
    },
  };
  vm.runInNewContext(source, { exports: module.exports, require(name) {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected import: ${name}`);
  }});
  const render = () => {
    cursor = 0;
    const result = module.exports.SavedAdviceProvider({ accountId, children: null }).props.value;
    effects.splice(0).forEach(effect => effect());
    return result;
  };
  return { render, async ready() { render(); await new Promise(setImmediate); return render(); },
    unmount() { cleanups.forEach(cleanup => cleanup?.()); } };
}
function backend() {
  return { records: new Map(), failRead: false, failWrite: false, delay: null,
    async read(owner) {
      if (this.failRead) throw new Error('Offline');
      return this.records.get(owner) ?? [];
    },
    async save(id, owner) {
      if (this.delay) await this.delay;
      if (this.failWrite) throw new Error('Offline');
      const rows = this.records.get(owner) ?? [];
      if (!rows.some(row => row.answer_id === id)) this.records.set(owner, [...rows, {
        answer_id: id, created_at: new Date().toISOString(), answers: { question_id: `${id}-question` },
      }]);
    },
    async remove(id, owner) {
      if (this.failWrite) throw new Error('Offline');
      this.records.set(owner, (this.records.get(owner) ?? []).filter(row => row.answer_id !== id));
    },
  };
}
function storage() {
  return { data: new Map(), fail: false,
    async getItem(key) { return this.data.get(key) ?? null; },
    async setItem(key, value) { if (this.fail) throw new Error('Disk full'); this.data.set(key, value); },
  };
}

test('real saves deduplicate, restore across remounts, and support remove/undo', async () => {
  const api = backend(), disk = storage(), app = mount(api, disk);
  await app.ready();
  await app.render().saveAdvice('real', 'real-question');
  await app.render().saveAdvice('real', 'real-question');
  assert.equal(app.render().saved.length, 1);
  assert.equal(api.records.get('account-a').length, 1);
  assert.equal(disk.data.size, 0);
  const restarted = mount(api, disk);
  assert.equal((await restarted.ready()).saved[0].adviceId, 'real-question');
  await restarted.render().removeAdvice('real');
  assert.equal(restarted.render().saved.length, 0);
  await restarted.render().saveAdvice('real', 'real-question');
  assert.equal(api.records.get('account-a').length, 1);
});

test('real saves remain account-specific while demo saves remain local', async () => {
  const api = backend(), disk = storage(), app = mount(api, disk);
  await app.ready();
  await app.render().saveAdvice('real', 'real-question');
  await app.render().saveAdvice('demo', 'demo-question');
  assert.equal(app.render().saved.length, 2);
  assert.equal(api.records.get('account-a').length, 1);
  assert.equal(JSON.parse(disk.data.get('transition-explorers.saved-advice.v1.account-a'))[0].answerId, 'demo');
  const other = mount(api, disk, 'account-b');
  assert.equal((await other.ready()).saved.length, 0);
  await app.render().removeAdvice('demo');
  assert.equal(app.render().saved.length, 1);
});

test('load failures block writes until retry, and failed mutations preserve visible state', async () => {
  const api = backend(), disk = storage(); api.failRead = true;
  const app = mount(api, disk);
  assert.equal((await app.ready()).ready, false);
  await assert.rejects(app.render().saveAdvice('real', 'real-question'), /Wait/);
  api.failRead = false; app.render().reload();
  assert.equal((await app.ready()).ready, true);
  api.failWrite = true;
  await assert.rejects(app.render().saveAdvice('real', 'real-question'), /Offline/);
  assert.equal(app.render().saved.length, 0);
  assert.equal(app.render().busy, false);
  api.failWrite = false;
  await app.render().saveAdvice('real', 'real-question');
  api.failWrite = true;
  await assert.rejects(app.render().removeAdvice('real'), /Offline/);
  assert.equal(app.render().saved.length, 1);
});

test('overlapping mutations are rejected and late saves cannot populate another account', async () => {
  const api = backend(), disk = storage(), app = mount(api, disk);
  await app.ready();
  let release; api.delay = new Promise(resolve => { release = resolve; });
  const saving = app.render().saveAdvice('real', 'real-question');
  await assert.rejects(app.render().removeAdvice('real'), /already running/);
  app.unmount();
  const other = mount(api, disk, 'account-b'); await other.ready();
  release(); await saving;
  assert.equal(other.render().saved.length, 0);
  assert.equal(api.records.get('account-a').length, 1);
  assert.equal(api.records.has('account-b'), false);
});

test('legacy local real saves stay on disk without becoming fake remote saves', async () => {
  const api = backend(), disk = storage();
  const key = 'transition-explorers.saved-advice.v1.account-a';
  disk.data.set(key, JSON.stringify([{ answerId: 'real', adviceId: 'real-question', savedAt: new Date().toISOString() }]));
  const app = mount(api, disk); await app.ready();
  assert.equal(app.render().saved.length, 0);
  await app.render().saveAdvice('demo', 'demo-question');
  assert.equal(JSON.parse(disk.data.get(key)).length, 2);
  assert.equal(api.records.size, 0);
  disk.fail = true;
  await assert.rejects(app.render().removeAdvice('demo'), /Disk full/);
  assert.equal(app.render().isSaved('demo'), true);
  await assert.rejects(app.render().saveAdvice('real', 'wrong-question'), /not available/);
});

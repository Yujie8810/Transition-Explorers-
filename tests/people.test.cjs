const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports) {
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
const row = { id: 'real-user', full_name: ' Yuji ', current_role: ' Engineer ', major: 'CS', bio: 'Hello', expertise: ['Code reviews'], listed_in_people: true };
function api() {
  const state = { rows: [row], writes: [], error: null };
  const result = load('src/features/people/peopleApi.ts', { '../../lib/supabase': { supabase: {
    from(table) {
      assert.equal(table, 'Profiles');
      return {
        select() { return { async order() { return { data: state.rows, error: state.error }; } }; },
        update(input) { return { eq(column, id) {
          assert.equal(column, 'id'); state.writes.push({ id, input });
          return { select() { return { async single() { return { data: { ...row, ...input, id }, error: state.error }; } }; } };
        } }; },
      };
    },
  } } });
  return { ...result, state };
}
test('directory maps real profile fields, preserves opt-in state and handles missing names', async () => {
  const subject = api();
  const [guide] = await subject.fetchDirectory();
  assert.equal(guide.id, 'real-user'); assert.equal(guide.name, 'Yuji'); assert.equal(guide.role, 'Engineer');
  assert.equal(guide.listed, true);
  const fallback = subject.mapDirectoryProfile({ ...row, full_name: null, current_role: null, listed_in_people: false });
  assert.equal(fallback.name, 'Community member'); assert.equal(fallback.role, 'CS'); assert.equal(fallback.listed, false);
});
test('directory saves are owner-scoped, trim fields, deduplicate skills, and support hiding', async () => {
  const subject = api();
  const guide = await subject.saveDirectoryProfile('owner-a', { role: ' Engineer ', expertise: [' SQL ', '', 'SQL'], bio: ' Hi ', listed: true });
  assert.equal(subject.state.writes[0].id, 'owner-a');
  assert.equal(guide.role, 'Engineer'); assert.equal(guide.bio, 'Hi');
  assert.deepEqual(Array.from(guide.expertise), ['SQL']);
  const hidden = await subject.saveDirectoryProfile('owner-a', { role: '', expertise: [], bio: '', listed: false });
  assert.equal(hidden.listed, false);
});
test('directory validation and backend errors do not report a successful save', async () => {
  const subject = api();
  for (const input of [
    { role: '', expertise: [], bio: '', listed: true },
    { role: 'Engineer', expertise: Array.from({ length: 11 }, (_, i) => `Skill ${i}`), bio: '', listed: true },
    { role: 'Engineer', expertise: ['x'.repeat(61)], bio: '', listed: true },
  ]) await assert.rejects(subject.saveDirectoryProfile('owner-a', input));
  assert.equal(subject.state.writes.length, 0);
  subject.state.error = new Error('Offline');
  await assert.rejects(subject.fetchDirectory(), /Offline/);
  await assert.rejects(subject.saveDirectoryProfile('owner-a', { role: 'Engineer', expertise: [], bio: '', listed: true }), /Offline/);
});
function mount(backend) {
  const slots = [], effects = [], cleanups = [];
  let cursor = 0;
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useCallback(fn, deps) { const i = cursor++; if (!slots[i]) slots[i] = fn; return slots[i]; },
    useEffect(effect, deps) { const i = cursor++; if (!slots[i] || deps.some((v, j) => v !== slots[i][j])) effects.push(() => { cleanups[i]?.(); cleanups[i] = effect(); }); slots[i] = deps; },
  };
  const { PeopleProvider } = load('src/features/people/PeopleProvider.tsx', {
    react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    '../../data/sampleData': { sampleGuides: [{ id: 'taylor', name: 'Taylor', expertise: [] }] },
    './peopleApi': backend,
  });
  return {
    render() { cursor = 0; const value = PeopleProvider({ children: null, accountId: 'owner-a' }).props.value; effects.splice(0).forEach(fn => fn()); return value; },
    unmount() { cleanups.forEach(fn => fn?.()); },
    async ready() { this.render(); await new Promise(setImmediate); return this.render(); },
  };
}
test('People shows opted-in real users alongside mocks and preserves hidden contacts for Circle', async () => {
  const app = mount({ async fetchDirectory() { return [{ id: 'owner-a', listed: true }, { id: 'hidden', listed: false }]; }, async saveDirectoryProfile(id, input) { return { id, ...input }; } });
  let directory = await app.ready();
  assert.deepEqual(Array.from(directory.people, x => x.id), ['owner-a', 'taylor']);
  assert.deepEqual(Array.from(directory.guides, x => x.id), ['owner-a', 'hidden', 'taylor']);
  await directory.save({ role: 'Engineer', expertise: [], bio: '', listed: false });
  directory = app.render();
  assert.deepEqual(Array.from(directory.people, x => x.id), ['taylor']);
  assert.ok(directory.guides.some(x => x.id === 'owner-a'));
});
test('failed directory loads keep mock people available, block editing, and allow retry', async () => {
  let fail = true;
  const app = mount({ async fetchDirectory() { if (fail) throw new Error('Offline'); return [{ id: 'owner-a', listed: true }]; } });
  let directory = await app.ready();
  assert.equal(directory.ready, false); assert.ok(directory.loadError);
  assert.deepEqual(Array.from(directory.people, x => x.id), ['taylor']);
  await assert.rejects(directory.save({}), /Wait/);
  fail = false; directory.reload(); await new Promise(setImmediate); directory = app.render();
  assert.equal(directory.ready, true); assert.equal(directory.loadError, '');
  assert.ok(directory.people.some(x => x.id === 'owner-a'));
});
test('failed publication leaves the saved listing unchanged; stale reads cannot undo a save', async () => {
  let resolveRead, failSave = true, read = 0;
  const app = mount({
    async fetchDirectory() { if (++read === 1) return [{ id: 'owner-a', listed: false }]; return new Promise(resolve => { resolveRead = resolve; }); },
    async saveDirectoryProfile(id, input) { if (failSave) throw new Error('Offline'); return { id, ...input }; },
  });
  let directory = await app.ready();
  const input = { role: 'Engineer', expertise: [], bio: '', listed: true };
  await assert.rejects(directory.save(input), /Offline/);
  assert.equal(app.render().people.length, 1);
  directory.reload(); failSave = false; await directory.save(input);
  resolveRead([{ id: 'owner-a', listed: false }]); await new Promise(setImmediate);
  assert.ok(app.render().people.some(x => x.id === 'owner-a'));
});
test('late directory results are ignored after logout', async () => {
  let resolveRead;
  const app = mount({ fetchDirectory() { return new Promise(resolve => { resolveRead = resolve; }); } });
  app.render(); app.unmount(); resolveRead([{ id: 'owner-a', listed: true }]); await new Promise(setImmediate);
  assert.deepEqual(Array.from(app.render().people, x => x.id), ['taylor']);
});

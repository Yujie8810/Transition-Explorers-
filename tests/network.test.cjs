const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the provider against controllable storage, including remounts and failed writes.
function mount(storage) {
  const slots = [];
  let cursor = 0;
  const effects = [];
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
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
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('src/features/network/NetworkProvider.tsx', 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { exports: module.exports, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) };
    if (name.includes('async-storage')) return { __esModule: true, default: storage };
    if (name.includes('sampleData')) return { sampleGuides: [{ id: 'taylor' }] };
    throw new Error(`Unexpected import: ${name}`);
  }});
  const render = () => {
    cursor = 0;
    const result = module.exports.NetworkProvider({ children: null, accountId: 'test-account' }).props.value;
    effects.splice(0).forEach((effect) => effect());
    return result;
  };
  return { render, async ready() { render(); await new Promise(setImmediate); return render(); } };
}
function storage(raw = null) {
  return { raw, fail: false, async getItem() { return this.raw; }, async setItem(key, value) {
    if (this.fail) throw new Error('Storage full');
    this.raw = value;
  }};
}
const plan = (minutes = 60) => ({ guideId: 'taylor', topic: 'First week', durationMinutes: 30, startsAt: new Date(Date.now() + minutes * 60000).toISOString() });

test('People requests persist with their contact across remounts', async () => {
  const disk = storage();
  const app = mount(disk);
  const network = await app.ready();
  await network.saveRequest({ guideId: 'taylor', message: '  Help with my first role  ', kind: 'check-in' });
  const restored = await mount(disk).ready();
  assert.equal(restored.contactIds[0], 'taylor');
  assert.equal(restored.requests[0].message, 'Help with my first role');
  assert.equal(restored.requests[0].kind, 'check-in');
});
test('concurrent saves retain both records and deduplicate contacts', async () => {
  const app = mount(storage());
  const network = await app.ready();
  await Promise.all([network.addContact('taylor'), network.saveRequest({ guideId: 'taylor', message: 'Advice please', kind: 'advice' })]);
  assert.equal(app.render().contactIds.length, 1);
  assert.equal(app.render().requests.length, 1);
});
test('failed writes do not report success or change state; retry works', async () => {
  const disk = storage(); const app = mount(disk); const network = await app.ready();
  disk.fail = true;
  await assert.rejects(network.addContact('taylor'), /Storage full/);
  assert.equal(app.render().contactIds.length, 0);
  disk.fail = false;
  await network.addContact('taylor');
  assert.equal(app.render().contactIds.length, 1);
});
test('check-ins persist, reject overlaps and past times, and can be edited and cancelled', async () => {
  const disk = storage(); const app = mount(disk); const network = await app.ready();
  await network.addContact('taylor');
  await network.saveCheckIn(plan());
  await assert.rejects(network.saveCheckIn(plan(65)), /already have a check-in/);
  await assert.rejects(network.saveCheckIn(plan(-60)), /future/);
  await assert.rejects(network.removeContact('taylor'), /Cancel upcoming/);
  const id = app.render().checkIns[0].id;
  await network.saveCheckIn({ ...plan(120), topic: 'Updated topic' }, id);
  const restored = await mount(disk).ready();
  assert.equal(restored.checkIns.length, 1);
  assert.equal(restored.checkIns[0].topic, 'Updated topic');
  await network.cancelCheckIn(id);
  await network.removeContact('taylor');
  assert.equal(app.render().checkIns.length, 0);
  assert.equal(app.render().contactIds.length, 0);
});
test('corrupt storage blocks writes and preserves original data', async () => {
  const disk = storage('{broken'); const app = mount(disk); const network = await app.ready();
  assert.equal(network.ready, false);
  assert.match(network.loadError, /could not be loaded/);
  await assert.rejects(network.addContact('taylor'), /still loading/);
  assert.equal(disk.raw, '{broken');
});

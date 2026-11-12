const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const backend = require('./helpers/circleBackend.cjs');

// Exercise the provider against controllable storage, including remounts and failed writes.
function mount(storage, api = backend(), accountId = 'test-account') {
  const slots = [];
  let cursor = 0;
  const effects = [], cleanups = [];
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
      if (!slots[index] || deps.some((value, i) => value !== slots[index][i])) effects.push(() => { cleanups[index]?.(); cleanups[index] = effect(); });
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
    if (name === './networkApi') return Object.fromEntries(
      ['fetchCircleContacts', 'addCircleContact', 'removeCircleContact',
       'fetchGuidanceRequests', 'saveGuidanceRequest', 'dismissGuidanceRequest', 'fetchIncomingRequests', 'respondToGuidanceRequest',
       'fetchCheckIns', 'saveRemoteCheckIn', 'cancelRemoteCheckIn', 'fetchIncomingCheckIns', 'respondToCheckIn', 'fetchRequestMessages', 'sendRequestMessage', 'fetchCheckInTimeProposals', 'proposeCheckInTime', 'respondToCheckInTimeProposal'].map(key => [key, api[key].bind(api)]));
    if (name.includes('sampleData')) return { sampleGuides: [{ id: 'taylor' }] };
    throw new Error(`Unexpected import: ${name}`);
  }});
  const render = () => {
    cursor = 0;
    const result = module.exports.NetworkProvider({ children: null, accountId }).props.value;
    effects.splice(0).forEach((effect) => effect());
    return result;
  };
  return { render, unmount() { cleanups.forEach(cleanup => cleanup?.()); }, async ready() { render(); await new Promise(setImmediate); return render(); } };
}
function storage(raw = null) {
  return { raw, fail: false, async getItem() { return this.raw; }, async setItem(key, value) {
    if (this.fail) throw new Error('Storage full');
    this.raw = value;
  }};
}
const plan = (minutes = 60) => ({ guideId: 'taylor', topic: 'First week', durationMinutes: 30, startsAt: new Date(Date.now() + minutes * 60000).toISOString() });

test('People requests persist with their contact across remounts', async () => {
  const disk = storage(), api = backend();
  const app = mount(disk, api);
  const network = await app.ready();
  await network.saveRequest({ guideId: 'taylor', message: '  Help with my first role  ', kind: 'check-in' });
  const restored = await mount(storage(), api).ready();
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
  const disk = storage(), api = backend(); const app = mount(disk, api); const network = await app.ready();
  api.failWrite = true;
  await assert.rejects(network.addContact('taylor'), /Offline/);
  assert.equal(app.render().contactIds.length, 0);
  api.failWrite = false;
  await network.addContact('taylor');
  assert.equal(app.render().contactIds.length, 1);
});
test('check-ins persist, reject overlaps and past times, and can be edited and cancelled', async () => {
  const disk = storage(), api = backend(); const app = mount(disk, api); const network = await app.ready();
  await network.addContact('taylor');
  await network.saveCheckIn(plan());
  await assert.rejects(network.saveCheckIn(plan(65)), /already have a check-in/);
  await assert.rejects(network.saveCheckIn(plan(-60)), /future/);
  await assert.rejects(network.removeContact('taylor'), /Cancel upcoming/);
  const id = app.render().checkIns[0].id;
  await network.saveCheckIn({ ...plan(120), topic: 'Updated topic' }, id);
  const restored = await mount(disk, api).ready();
  assert.equal(restored.checkIns.length, 1);
  assert.equal(restored.checkIns[0].topic, 'Updated topic');
  await network.cancelCheckIn(id);
  await network.removeContact('taylor');
  assert.equal(app.render().checkIns.length, 0);
  assert.equal(app.render().contactIds.length, 0);
});
test('obsolete corrupt local storage is left untouched and does not block remote Circle', async () => {
  const disk = storage('{broken'); const app = mount(disk); const network = await app.ready();
  assert.equal(network.ready, true);
  await network.addContact('taylor');
  assert.equal(disk.raw, '{broken');
});


test('contacts restore on a fresh device, deduplicate, and remain account-specific', async () => {
  const api = backend(), app = mount(storage(), api, 'account-a');
  await app.ready();
  await app.render().addContact('taylor');
  await app.render().addContact('taylor');
  assert.equal(api.records.get('account-a').length, 1);
  const second = mount(storage(), api, 'account-a');
  assert.equal((await second.ready()).contactIds[0], 'taylor');
  assert.equal((await mount(storage(), api, 'account-b').ready()).contactIds.length, 0);
  await second.render().removeContact('taylor');
  app.render().reload();
  assert.equal((await app.ready()).contactIds.length, 0);
});

test('remote load failures block writes and retry; failed deletes keep the contact', async () => {
  const api = backend(); api.failRead = true;
  const app = mount(storage(), api);
  assert.equal((await app.ready()).ready, false);
  await assert.rejects(app.render().addContact('taylor'), /still loading/);
  api.failRead = false; app.render().reload(); await app.ready();
  await app.render().addContact('taylor');
  api.failWrite = true;
  await assert.rejects(app.render().removeContact('taylor'), /Offline/);
  assert.equal(app.render().contactIds.length, 1);
});

test('failed request writes preserve both lists; retry succeeds without a local write', async () => {
  const api = backend(), disk = storage(), app = mount(disk, api);
  await app.ready(); api.failWrite = true; disk.fail = true;
  const request = { guideId: 'taylor', message: 'Help please', kind: 'advice' };
  await assert.rejects(app.render().saveRequest(request), /Offline/);
  assert.equal(app.render().contactIds.length, 0);
  assert.equal(app.render().requests.length, 0);
  api.failWrite = false; await app.render().saveRequest(request);
  assert.equal(app.render().requests.length, 1);
  assert.equal(api.records.get('test-account').length, 1);
  assert.equal(disk.raw, null);
});

test('a lost response retries the same remote request rather than duplicating it', async () => {
  const api = backend(), app = mount(storage(), api); await app.ready();
  const request = { guideId: 'taylor', message: 'Help please', kind: 'advice' };
  api.loseResponse = true;
  await assert.rejects(app.render().saveRequest(request), /Response lost/);
  assert.equal(app.render().requests.length, 0);
  assert.equal(api.requests.get('test-account').length, 1);
  await app.render().saveRequest(request);
  assert.equal(app.render().requests.length, 1);
  assert.equal(api.requests.get('test-account').length, 1);
});

test('request dismissal persists across devices, keeps the contact, and isolates accounts', async () => {
  const api = backend(), app = mount(storage(), api, 'account-a'); await app.ready();
  await app.render().saveRequest({ guideId: 'taylor', message: 'Help please', kind: 'advice' });
  const second = mount(storage(), api, 'account-a'); await second.ready();
  assert.equal(second.render().requests.length, 1);
  assert.equal((await mount(storage(), api, 'account-b').ready()).requests.length, 0);
  const id = second.render().requests[0].id;
  api.failWrite = true;
  await assert.rejects(second.render().dismissRequest(id), /Offline/);
  assert.equal(second.render().requests.length, 1);
  api.failWrite = false; await second.render().dismissRequest(id);
  app.render().reload(); await app.ready();
  assert.equal(app.render().requests.length, 0);
  assert.equal(app.render().contactIds.length, 1);
});

test('legacy local requests remain on disk without becoming remote records', async () => {
  const legacy = [{ id: 'legacy', guideId: 'taylor', message: 'Older local request', kind: 'advice' }];
  const api = backend(), disk = storage(JSON.stringify({ contactIds: ['taylor'], requests: legacy, checkIns: [] }));
  const app = mount(disk, api); await app.ready();
  assert.equal(app.render().requests.length, 0);
  await app.render().addContact('taylor');
  await app.render().saveCheckIn(plan());
  assert.deepEqual(JSON.parse(disk.raw).requests, legacy);
  assert.equal(api.requests.size, 0);
});

test('legacy contacts stay on disk without becoming remote contacts', async () => {
  const api = backend(), disk = storage(JSON.stringify({ contactIds: ['taylor'], requests: [], checkIns: [] }));
  const app = mount(disk, api); await app.ready();
  assert.equal(app.render().contactIds.length, 0);
  assert.equal(api.records.size, 0);
  await app.render().addContact('taylor');
  await app.render().saveRequest({ guideId: 'taylor', message: 'Help please', kind: 'advice' });
  assert.deepEqual(JSON.parse(disk.raw).contactIds, ['taylor']);
  await app.render().removeContact('taylor');
  assert.equal((await mount(disk, api).ready()).contactIds.length, 0);
});

test('late contact writes stay bound to A and queued actions stop after unmount', async () => {
  const api = backend(), app = mount(storage(), api, 'account-a');
  await app.ready();
  let release; api.delay = new Promise(resolve => { release = resolve; });
  const first = app.render().addContact('taylor');
  const queued = app.render().addContact('taylor');
  // Attach the rejection handler immediately, before releasing the queue.
  const stopped = assert.rejects(queued, /still loading/);
  await new Promise(setImmediate); app.unmount();
  const other = mount(storage(), api, 'account-b'); await other.ready();
  release(); await first; await stopped;
  assert.deepEqual(api.records.get('account-a'), ['taylor']);
  assert.equal(other.render().contactIds.length, 0);
  assert.equal(api.records.has('account-b'), false);
});


test('request validation rejects blank, oversized messages and unsupported types', async () => {
  const api = backend(), app = mount(storage(), api); await app.ready();
  for (const request of [
    { guideId: 'taylor', message: ' ', kind: 'advice' },
    { guideId: 'taylor', message: 'a'.repeat(2001), kind: 'advice' },
    { guideId: 'taylor', message: 'Help', kind: 'unknown' },
  ]) await assert.rejects(app.render().saveRequest(request));
  assert.equal(api.requests.size, 0);
  assert.equal(api.records.size, 0);
});

test('a request completing after logout cannot populate another account', async () => {
  const api = backend(), app = mount(storage(), api, 'account-a'); await app.ready();
  let release; api.delay = new Promise(resolve => { release = resolve; });
  const saving = app.render().saveRequest({ guideId: 'taylor', message: 'Help', kind: 'advice' });
  await new Promise(setImmediate); app.unmount();
  const other = mount(storage(), api, 'account-b'); await other.ready();
  release(); await saving;
  assert.equal(api.requests.get('account-a').length, 1);
  assert.equal(other.render().requests.length, 0);
  assert.equal(api.requests.has('account-b'), false);
});


test('check-ins restore and reschedule across fresh devices; cancellation keeps other Circle records', async () => {
  const api = backend(), app = mount(storage(), api, 'a'); await app.ready();
  await app.render().saveRequest({ guideId: 'taylor', message: 'Help', kind: 'advice' });
  await app.render().saveCheckIn(plan());
  const other = mount(storage(), api, 'a'); await other.ready();
  const id = other.render().checkIns[0].id;
  await other.render().saveCheckIn({ ...plan(120), topic: 'New topic' }, id);
  app.render().reload(); await app.ready();
  assert.equal(app.render().checkIns[0].topic, 'New topic');
  assert.equal((await mount(storage(), api, 'b').ready()).checkIns.length, 0);
  await other.render().cancelCheckIn(id);
  app.render().reload(); await app.ready();
  assert.equal(app.render().checkIns.length, 0);
  assert.equal(app.render().requests.length, 1);
  assert.equal(app.render().contactIds.length, 1);
});

test('check-in load failures block Circle until retry; failed mutations keep visible state', async () => {
  const api = backend(); api.failCheckInRead = true;
  const app = mount(storage(), api); assert.equal((await app.ready()).ready, false);
  await assert.rejects(app.render().saveCheckIn(plan()), /still loading/);
  api.failCheckInRead = false; app.render().reload(); await app.ready();
  await app.render().addContact('taylor'); api.failWrite = true;
  await assert.rejects(app.render().saveCheckIn(plan()), /Offline/);
  assert.equal(app.render().checkIns.length, 0);
  api.failWrite = false; await app.render().saveCheckIn(plan());
  const id = app.render().checkIns[0].id, topic = app.render().checkIns[0].topic;
  api.failWrite = true;
  await assert.rejects(app.render().saveCheckIn({ ...plan(120), topic: 'Unsaved' }, id), /Offline/);
  await assert.rejects(app.render().cancelCheckIn(id), /Offline/);
  assert.equal(app.render().checkIns[0].topic, topic);
});

test('server rejects stale-device overlap and contact removal; adjacent check-ins are allowed', async () => {
  const api = backend(), first = mount(storage(), api), stale = mount(storage(), api);
  await first.ready(); await first.render().addContact('taylor'); await stale.ready();
  const start = new Date(Date.now() + 3600000).toISOString();
  await first.render().saveCheckIn({ ...plan(), startsAt: start });
  await assert.rejects(stale.render().saveCheckIn({ ...plan(), startsAt: start }), /already have/);
  await assert.rejects(stale.render().removeContact('taylor'), /Cancel upcoming/);
  const adjacent = new Date(Date.parse(start) + 30 * 60000).toISOString();
  await stale.render().saveCheckIn({ ...plan(), startsAt: adjacent });
  assert.equal(api.checkIns.get('test-account').length, 2);
});

test('history loads remotely while legacy local check-ins stay untouched and are not uploaded', async () => {
  const old = { ...plan(-120), id: 'past' };
  const raw = JSON.stringify({ contactIds: ['taylor'], requests: [], checkIns: [{ ...plan(), id: 'legacy' }] });
  const disk = storage(raw), api = backend(); api.checkIns.set('test-account', [old]);
  const app = mount(disk, api); await app.ready();
  assert.equal(app.render().checkIns[0].id, 'past');
  assert.equal(app.render().checkIns.length, 1);
  await app.render().addContact('taylor'); await app.render().removeContact('taylor');
  assert.equal(app.render().checkIns[0].id, 'past');
  assert.equal(disk.raw, raw);
});

test('lost check-in responses retry without duplicates; late results cannot enter another account', async () => {
  const api = backend(), app = mount(storage(), api, 'a'); await app.ready();
  await app.render().addContact('taylor'); const input = plan(); api.loseResponse = true;
  await assert.rejects(app.render().saveCheckIn(input), /Response lost/);
  await app.render().saveCheckIn(input);
  assert.equal(app.render().checkIns.length, 1); assert.equal(api.checkIns.get('a').length, 1);
  let release; api.delay = new Promise(resolve => { release = resolve; });
  const pending = app.render().saveCheckIn(plan(120));
  await new Promise(setImmediate); app.unmount();
  const other = mount(storage(), api, 'b'); await other.ready(); release(); await pending;
  assert.equal(other.render().checkIns.length, 0);
  assert.equal(api.checkIns.get('a').length, 2);
});

test('real account UUIDs work for contacts, guidance requests and check-ins across devices', async () => {
  const api = backend(), guideId = '11111111-1111-4111-8111-111111111111';
  const first = await mount(storage(), api).ready();
  await first.addContact(guideId);
  await first.saveRequest({ guideId, kind: 'advice', message: 'Career advice' });
  await first.saveCheckIn({ ...plan(), guideId });
  const restored = await mount(storage(), api).ready();
  assert.equal(restored.contactIds[0], guideId);
  assert.equal(restored.requests[0].guideId, guideId);
  assert.equal(restored.checkIns[0].guideId, guideId);
  await assert.rejects(restored.addContact('unknown-guide'), /no longer available/);
});

const accountA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const accountB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const accountC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

test('self contacts, requests, and scheduled plans are rejected before a backend write', async () => {
  const api = backend(), app = await mount(storage(), api, accountA).ready();
  await assert.rejects(app.addContact(accountA), /yourself/);
  await assert.rejects(app.saveRequest({ guideId: accountA, kind: 'advice', message: 'Self' }), /yourself/);
  await assert.rejects(app.saveCheckIn({ ...plan(), guideId: accountA }), /yourself/);
  assert.equal(api.records.size, 0); assert.equal(api.requests.size, 0); assert.equal(api.checkIns.size, 0);
});

test('guidance becomes a private two-way conversation and refresh preserves sender and recipient state', async () => {
  const api = backend();
  const a = mount(storage(), api, accountA), b = mount(storage(), api, accountB), c = mount(storage(), api, accountC);
  await a.ready(); await b.ready(); await c.ready();
  await a.render().saveRequest({ guideId: accountB, kind: 'advice', message: 'Review my resume?' });
  const id = a.render().requests[0].id;
  await b.render().refresh();
  assert.equal(b.render().inbox[0].senderId, accountA);
  await b.render().sendMessage(id, ' Happy to help. ');
  await a.render().refresh();
  assert.equal(a.render().messages[0].body, 'Happy to help.');
  assert.equal(a.render().requests[0].status, 'answered');
  await a.render().sendMessage(id, 'Thank you!');
  await b.render().refresh();
  assert.equal(b.render().messages.length, 2);
  assert.equal(b.render().messages[1].senderId, accountA);
  await c.render().refresh();
  assert.equal(c.render().inbox.length, 0); assert.equal(c.render().messages.length, 0);
  await assert.rejects(c.render().sendMessage(id, 'Forged message'), /only for delivered/);
  await assert.rejects(a.render().respondToRequest(id, 'accepted', ''), /no longer available/);
});

test('hiding a delivered request retains the recipient conversation; a reply brings it back to the sender', async () => {
  const api = backend(), a = mount(storage(), api, accountA), b = mount(storage(), api, accountB);
  await a.ready(); await b.ready();
  await a.render().saveRequest({ guideId: accountB, kind: 'advice', message: 'Career advice' });
  const id = a.render().requests[0].id;
  await a.render().dismissRequest(id); await b.render().refresh();
  assert.equal(a.render().requests.length, 0); assert.equal(b.render().inbox.length, 1);
  await b.render().sendMessage(id, 'Here is my advice.');
  await a.render().refresh(); assert.equal(a.render().requests.length, 1);
  assert.equal(a.render().messages[0].body, 'Here is my advice.');
});

test('chat validation, failures, lost-response retries and background read failures preserve the thread', async () => {
  const api = backend(), a = mount(storage(), api, accountA), b = mount(storage(), api, accountB);
  await a.ready(); await b.ready();
  await a.render().saveRequest({ guideId: accountB, kind: 'advice', message: 'Help' });
  const id = a.render().requests[0].id;
  await b.render().refresh();
  for (const body of [' ', 'x'.repeat(5001)]) await assert.rejects(b.render().sendMessage(id, body), /1–5000/);
  api.failWrite = true;
  await assert.rejects(b.render().sendMessage(id, 'Advice'), /Offline/);
  assert.equal(b.render().messages.length, 0);
  api.failWrite = false; api.loseResponse = true;
  await assert.rejects(b.render().sendMessage(id, 'Advice'), /lost/);
  await b.render().sendMessage(id, 'Advice');
  assert.equal(api.messages.size, 1); assert.equal(b.render().messages.length, 1);
  api.failRead = true; await assert.rejects(b.render().refresh(), /Offline/);
  assert.equal(b.render().ready, true); assert.equal(b.render().messages.length, 1);
  api.failRead = false; await b.render().refresh(); assert.equal(b.render().messages.length, 1);
});

test('demo requests stay personal and cannot open a chat', async () => {
  const api = backend(), app = mount(storage(), api, accountA);
  await app.ready(); await app.render().saveRequest({ guideId: 'taylor', kind: 'advice', message: 'Demo' });
  assert.equal(app.render().requests[0].delivered, false);
  await assert.rejects(app.render().sendMessage(app.render().requests[0].id, 'Message'), /only for delivered/);
});

test('scheduled check-ins deliver time and duration; recipient acceptance and sender cancellation sync both ways', async () => {
  const api = backend(), a = mount(storage(), api, accountA), b = mount(storage(), api, accountB), c = mount(storage(), api, accountC);
  await a.ready(); await b.ready(); await c.ready();
  await a.render().addContact(accountB);
  const saved = await a.render().saveCheckIn({ ...plan(), guideId: accountB });
  const id = a.render().checkIns[0].id;
  assert.equal(saved.id, id);
  assert.equal(saved.delivered, true);
  assert.equal(saved.status, 'pending');
  await a.render().addContact('taylor');
  await assert.rejects(a.render().saveCheckIn({ ...plan(), guideId: 'taylor' }, id), /different contact/);
  assert.equal(a.render().checkIns[0].guideId, accountB);
  await a.render().removeContact('taylor');
  assert.equal(a.render().checkIns[0].status, 'pending');
  await b.render().refresh();
  const invitation = b.render().incomingCheckIns[0];
  assert.equal(invitation.startsAt, a.render().checkIns[0].startsAt); assert.equal(invitation.durationMinutes, 30);
  await b.render().respondToCheckIn(id, 'accepted', invitation.revision);
  await a.render().refresh(); assert.equal(a.render().checkIns[0].status, 'accepted');
  await c.render().refresh(); assert.equal(c.render().incomingCheckIns.length, 0);
  await assert.rejects(c.render().respondToCheckIn(id, 'declined', 1), /unavailable/);
  await a.render().cancelCheckIn(id); await b.render().refresh();
  assert.equal(a.render().checkIns[0].status, 'cancelled'); assert.equal(b.render().incomingCheckIns[0].status, 'cancelled');
  await a.render().removeContact(accountB); assert.equal(a.render().contactIds.length, 0);
});

test('rescheduling resets the decision and stale invitation acceptance cannot accept the new time', async () => {
  const api = backend(), a = mount(storage(), api, accountA), b = mount(storage(), api, accountB);
  await a.ready(); await b.ready(); await a.render().addContact(accountB);
  await a.render().saveCheckIn({ ...plan(), guideId: accountB }); await b.render().refresh();
  const { id, revision } = b.render().incomingCheckIns[0];
  await b.render().respondToCheckIn(id, 'accepted', revision); await a.render().refresh();
  await a.render().saveCheckIn({ ...plan(180), guideId: accountB }, id);
  assert.equal(a.render().checkIns[0].status, 'pending');
  await assert.rejects(b.render().respondToCheckIn(id, 'accepted', revision), /changed/);
  await b.render().refresh();
  await b.render().respondToCheckIn(id, 'declined', b.render().incomingCheckIns[0].revision);
  await a.render().refresh(); assert.equal(a.render().checkIns[0].status, 'declined');
});

test('recipient conflicts prevent acceptance and failed decisions leave the pending invitation visible', async () => {
  const api = backend(), a = mount(storage(), api, accountA), b = mount(storage(), api, accountB);
  await a.ready(); await b.ready();
  await b.render().addContact('taylor'); await b.render().saveCheckIn(plan());
  await a.render().addContact(accountB); await a.render().saveCheckIn({ ...plan(), guideId: accountB });
  await b.render().refresh(); const item = b.render().incomingCheckIns[0];
  await assert.rejects(b.render().respondToCheckIn(item.id, 'accepted', item.revision), /already have/);
  assert.equal(b.render().incomingCheckIns[0].status, 'pending');
  api.failWrite = true;
  await assert.rejects(b.render().respondToCheckIn(item.id, 'declined', item.revision), /Offline/);
  assert.equal(b.render().incomingCheckIns[0].status, 'pending');
  api.failWrite = false; await b.render().respondToCheckIn(item.id, 'declined', item.revision);
  assert.equal(b.render().incomingCheckIns[0].status, 'declined');
});

test('late chat sends after logout cannot populate another account', async () => {
  const api = backend(), a = mount(storage(), api, accountA), b = mount(storage(), api, accountB);
  await a.ready(); await b.ready(); await a.render().saveRequest({ guideId: accountB, kind: 'advice', message: 'Help' });
  await b.render().refresh(); const id = b.render().inbox[0].id;
  let finish; api.delay = new Promise(resolve => { finish = resolve; });
  const pending = b.render().sendMessage(id, 'Advice'); await new Promise(setImmediate); b.unmount();
  finish(); await pending; api.delay = null;
  const c = await mount(storage(), api, accountC).ready();
  assert.equal(c.messages.length, 0); assert.equal(c.inbox.length, 0);
});

async function proposalPair() {
  const api = backend(), a = mount(storage(), api, accountA), b = mount(storage(), api, accountB);
  await a.ready(); await b.ready(); await a.render().addContact(accountB);
  await a.render().saveCheckIn({ ...plan(120), guideId: accountB }); await b.render().refresh();
  const meeting = b.render().incomingCheckIns[0];
  const proposedStart = new Date(Date.now() + 240 * 60000).toISOString();
  return { api, a, b, meeting, proposedStart };
}
test('recipient proposes a new time without a contact; original sender accepts and both views update', async () => {
  const { a, b, meeting, proposedStart } = await proposalPair();
  assert.equal(b.render().contactIds.length, 0);
  await b.render().proposeTime(meeting.id, meeting.revision, proposedStart, 15);
  assert.equal(b.render().incomingCheckIns[0].startsAt, meeting.startsAt);
  await a.render().refresh(); const proposal = a.render().timeProposals[0];
  assert.equal(proposal.status, 'pending'); assert.equal(a.render().checkIns[0].startsAt, meeting.startsAt);
  await a.render().respondToTimeProposal(proposal.id, 'accepted');
  await b.render().refresh();
  for (const actual of [a.render().checkIns[0], b.render().incomingCheckIns[0]]) {
    assert.equal(actual.startsAt, proposedStart); assert.equal(actual.durationMinutes, 15);
    assert.equal(actual.status, 'accepted'); assert.equal(actual.revision, meeting.revision + 1);
  }
});
test('rejecting a new time leaves the original pending or accepted meeting unchanged', async () => {
  const { a, b, meeting, proposedStart } = await proposalPair();
  await b.render().respondToCheckIn(meeting.id, 'accepted', meeting.revision); await a.render().refresh();
  await b.render().proposeTime(meeting.id, meeting.revision, proposedStart, 15); await a.render().refresh();
  const id = a.render().timeProposals[0].id;
  await a.render().respondToTimeProposal(id, 'rejected'); await b.render().refresh();
  assert.equal(a.render().checkIns[0].startsAt, meeting.startsAt); assert.equal(a.render().checkIns[0].status, 'accepted');
  assert.equal(b.render().timeProposals[0].status, 'rejected'); assert.equal(b.render().incomingCheckIns[0].startsAt, meeting.startsAt);
});
test('proposal validation and roles reject invalid times and attempts to approve your own proposal', async () => {
  const { a, b, meeting, proposedStart } = await proposalPair();
  await assert.rejects(a.render().proposeTime(meeting.id, meeting.revision, proposedStart, 15), /unavailable/);
  for (const start of ['bad', new Date(Date.now() - 1000).toISOString()]) {
    await assert.rejects(b.render().proposeTime(meeting.id, meeting.revision, start, 15), /future/);
  }
  await assert.rejects(b.render().proposeTime(meeting.id, meeting.revision, meeting.startsAt, meeting.durationMinutes), /different/);
  await b.render().proposeTime(meeting.id, meeting.revision, proposedStart, 15);
  const id = b.render().timeProposals[0].id;
  await assert.rejects(b.render().respondToTimeProposal(id, 'accepted'), /original sender/);
  await assert.rejects(b.render().respondToCheckIn(meeting.id, 'accepted', meeting.revision), /awaiting/);
});
test('a lost proposal response retries once; failed writes and failed acceptance preserve both original and proposal', async () => {
  const { api, a, b, meeting, proposedStart } = await proposalPair();
  api.failWrite = true;
  await assert.rejects(b.render().proposeTime(meeting.id, meeting.revision, proposedStart, 15), /Offline/);
  assert.equal(b.render().timeProposals.length, 0);
  api.failWrite = false; api.loseResponse = true;
  await assert.rejects(b.render().proposeTime(meeting.id, meeting.revision, proposedStart, 15), /lost/);
  await b.render().proposeTime(meeting.id, meeting.revision, proposedStart, 15);
  assert.equal(api.proposals.size, 1);
  await a.render().refresh(); api.failWrite = true;
  await assert.rejects(a.render().respondToTimeProposal(a.render().timeProposals[0].id, 'accepted'), /Offline/);
  assert.equal(a.render().checkIns[0].startsAt, meeting.startsAt); assert.equal(a.render().timeProposals[0].status, 'pending');
});
test('sender edits or cancels invalidate pending proposals and stale acceptance cannot change the meeting', async () => {
  const { a, b, meeting, proposedStart } = await proposalPair();
  await b.render().proposeTime(meeting.id, meeting.revision, proposedStart, 15); await a.render().refresh();
  const id = a.render().timeProposals[0].id;
  await a.render().saveCheckIn({ ...plan(360), guideId: accountB }, meeting.id);
  await assert.rejects(a.render().respondToTimeProposal(id, 'accepted'), /changed/);
  await b.render().refresh(); assert.equal(b.render().timeProposals[0].status, 'superseded');
  await assert.rejects(b.render().proposeTime(meeting.id, meeting.revision, proposedStart, 15), /changed/);
  await b.render().proposeTime(meeting.id, b.render().incomingCheckIns[0].revision, proposedStart, 15);
  await a.render().refresh(); const secondId = a.render().timeProposals[1].id;
  await a.render().cancelCheckIn(meeting.id);
  await assert.rejects(a.render().respondToTimeProposal(secondId, 'accepted'), /changed/);
  await b.render().refresh(); assert.equal(b.render().timeProposals[1].status, 'superseded');
});
test('calendar conflict on acceptance leaves proposed time pending without changing the original', async () => {
  const { a, b, meeting, proposedStart } = await proposalPair();
  await b.render().addContact('taylor');
  await b.render().saveCheckIn({ ...plan(), startsAt: proposedStart, guideId: 'taylor' });
  await b.render().proposeTime(meeting.id, meeting.revision, proposedStart, 15); await a.render().refresh();
  await assert.rejects(a.render().respondToTimeProposal(a.render().timeProposals[0].id, 'accepted'), /conflict/);
  assert.equal(a.render().timeProposals[0].status, 'pending'); assert.equal(a.render().checkIns[0].startsAt, meeting.startsAt);
});
test('third account cannot see proposals and late proposal writes cannot leak after logout', async () => {
  const { api, a, b, meeting, proposedStart } = await proposalPair();
  let release; api.delay = new Promise(resolve => { release = resolve; });
  const pending = b.render().proposeTime(meeting.id, meeting.revision, proposedStart, 15);
  await new Promise(setImmediate); b.unmount(); release(); await pending; api.delay = null;
  const c = await mount(storage(), api, accountC).ready(); assert.equal(c.timeProposals.length, 0);
  await a.render().refresh(); assert.equal(a.render().timeProposals.length, 1);
});

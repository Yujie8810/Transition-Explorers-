const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function screen(file, params, accountId, overrides = {}, navigation = []) {
  const jsx = (type, props) => ({ type, props });
  const guides = [{ id: 'own-user', name: 'Me', role: 'Engineer', expertise: [], listed: true },
    { id: 'other-user', name: 'Other graduate', role: 'Engineer', expertise: [], listed: true }];
  const network = { ready: true, loadError: '', contactIds: [], requests: [], inbox: [], messages: [], checkIns: [], incomingCheckIns: [], timeProposals: [], reload() {}, ...overrides };
  const imports = {
    '../../components/Typography': { Text: 'Text', TextInput: 'TextInput' },
    react: { useState: initial => [initial, () => {}], useRef: initial => ({ current: initial }) },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'react-native': { Text: 'Text', View: 'View', Pressable: 'Pressable', TextInput: 'TextInput', StyleSheet: { create: value => value } },
    'expo-router': { useLocalSearchParams: () => params, router: { push: path => navigation.push(path), navigate: path => navigation.push(path) } },
    '../../components/Screen': { Screen: 'Screen' },
    '../../components/AppButton': { AppButton: 'AppButton' },
    '../../theme': { theme: { colors: {} } },
    '../auth/AuthProvider': { useAuth: () => ({ account: { id: accountId } }) },
    '../people/PeopleProvider': { usePeople: () => ({ guides, ready: true, loadError: '' }) },
    '../network/NetworkProvider': { useNetwork: () => network },
    './NetworkProvider': { useNetwork: () => network },
    './RequestsPanel': { RequestsPanel: 'RequestsPanel' },
    './TimeProposalCard': { TimeProposalCard: 'TimeProposalCard' },
    './useCircleSync': { useCircleSync: () => ({ syncError: '', refresh() {} }) },
    './styles': { styles: {} },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { exports: module.exports, require(name) {
    if (name in imports) return imports[name]; throw new Error(`Unexpected import: ${name}`);
  }});
  return module.exports.default ? module.exports.default(params) : module.exports.TimeProposalCard(params);
}
function find(node, predicate, found = []) {
  if (Array.isArray(node)) node.forEach(child => find(child, predicate, found));
  else if (node && typeof node === 'object') {
    if (predicate(node)) found.push(node);
    find(node.props?.children, predicate, found);
  }
  return found;
}
test('own graduate profile offers editing without self-contact or self-request actions', () => {
  const view = screen('src/features/people/GuideProfileScreen.tsx', { id: 'own-user' }, 'own-user');
  const labels = find(view, node => node.type === 'AppButton').map(node => node.props.label);
  assert.ok(labels.includes('Edit your profile'));
  assert.ok(!labels.includes('Add to Your Circle'));
  assert.ok(!labels.includes('Ask for guidance'));
});
test('another graduate keeps both contact and guidance actions', () => {
  const view = screen('src/features/people/GuideProfileScreen.tsx', { id: 'other-user' }, 'own-user');
  const labels = find(view, node => node.type === 'AppButton').map(node => node.props.label);
  assert.ok(labels.includes('Add to Your Circle')); assert.ok(labels.includes('Ask for guidance'));
});
test('direct navigation to a self-request route cannot show a request form', () => {
  const view = screen('src/features/people/HelpRequestScreen.tsx', { id: 'own-user' }, 'own-user');
  assert.equal(find(view, node => node.type === 'TextInput').length, 0);
  assert.ok(find(view, node => node.type === 'Text').some(node => /cannot request guidance from yourself/.test(node.props.children)));
});

test('incoming invitation places a new-time proposal action directly after Decline', () => {
  const meeting = { id: 'meeting', senderId: 'other-user', status: 'pending', revision: 1, startsAt: new Date(Date.now() + 3600000).toISOString(), durationMinutes: 15 };
  const view = screen('src/features/network/NetworkScreen.tsx', { section: 'check-ins' }, 'own-user', { incomingCheckIns: [meeting] });
  const labels = find(view, node => node.type === 'AppButton').map(node => node.props.label);
  const decline = labels.indexOf('Decline invitation');
  assert.ok(decline >= 0); assert.equal(labels[decline + 1], 'Reschedule');
});
test('pending proposal offers Accept/Reject only to the original sender', () => {
  const meeting = { id: 'meeting', status: 'pending', revision: 1 };
  const state = { timeProposals: [{ id: 'proposal', checkInId: 'meeting', baseRevision: 1, startsAt: new Date(Date.now() + 3600000).toISOString(), durationMinutes: 15, status: 'pending' }] };
  const sender = screen('src/features/network/TimeProposalCard.tsx', { meeting, owner: true, busy: false }, 'own-user', state);
  const recipient = screen('src/features/network/TimeProposalCard.tsx', { meeting, owner: false, busy: false }, 'other-user', state);
  assert.deepEqual(find(sender, node => node.type === 'AppButton').map(node => node.props.label), ['Accept new time', 'Reject new time']);
  assert.equal(find(recipient, node => node.type === 'AppButton').length, 0);
});

test('Circle buttons navigate to dedicated pages without showing section contents', () => {
  const navigation = [];
  const view = screen('src/features/network/NetworkScreen.tsx', {}, 'own-user', {}, navigation);
  assert.equal(find(view, node => node.type === 'RequestsPanel').length, 0);
  assert.equal(find(view, node => node.type === 'TextInput').length, 0);
  assert.equal(find(view, node => node.type === 'TimeProposalCard').length, 0);
  const destinations = [
    ['Requests received (0)', '/network/requests-received'],
    ['Your guidance requests (0)', '/network/guidance-requests'],
    ['Check-ins (0)', '/network/check-ins'],
    ['Contacts (0)', '/network/contacts'],
  ];
  for (const [label, route] of destinations) {
    find(view, node => node.type === 'AppButton' && node.props.label === label)[0].props.onPress();
    assert.equal(navigation.at(-1), route);
    assert.ok(fs.existsSync(`src/app${route}.tsx`));
  }
});

test('Circle section pages show their own content and provide a return to Circle', () => {
  const file = 'src/features/network/NetworkScreen.tsx';
  for (const section of ['received', 'sent', 'check-ins', 'contacts']) {
    const navigation = [];
    const view = screen(file, { section }, 'own-user', {}, navigation);
    assert.equal(find(view, node => node.type === 'AppButton' && /^(Requests received|Your guidance requests|Check-ins|Contacts) \(/.test(node.props.label)).length, 0);
    const panels = find(view, node => node.type === 'RequestsPanel');
    assert.equal(panels.length, section === 'received' || section === 'sent' ? 1 : 0);
    if (panels.length) assert.equal(panels[0].props.section, section);
    assert.equal(find(view, node => node.type === 'TextInput').length, section === 'contacts' ? 1 : 0);
    find(view, node => node.type === 'AppButton' && node.props.label === 'Back to Your Circle')[0].props.onPress();
    assert.equal(navigation[0], '/network');
  }
});

test('check-in invitations are grouped by response with actions only on upcoming invitations', () => {
  const startsAt = new Date(Date.now() + 3600000).toISOString();
  const incomingCheckIns = ['pending', 'accepted', 'declined'].map(status => ({
    id: status, topic: `${status} meeting`, senderId: 'other-user', status, revision: 1, startsAt, durationMinutes: 15,
  }));
  const view = screen('src/features/network/NetworkScreen.tsx', { section: 'check-ins' }, 'own-user', { incomingCheckIns });
  const groups = find(view, node => node.type === 'View' && find(node.props.children, child => child.type === 'Text' && child.props.accessibilityRole === 'header').length);
  assert.equal(groups.length, 3);
  for (const [index, status] of ['pending', 'accepted', 'declined'].entries()) {
    const cards = find(groups[index], node => node.type === 'TimeProposalCard');
    assert.equal(cards.length, 1);
    assert.equal(cards[0].props.meeting.status, status);
    const labels = find(groups[index], node => node.type === 'AppButton').map(node => node.props.label);
    assert.equal(labels.includes('Accept invitation'), status === 'pending');
    assert.equal(labels.includes('Decline invitation'), status === 'pending');
  }
});


test('choosing Check-in from guidance adds the graduate before opening the time scheduler', async () => {
  const navigation = [];
  let added = '';
  const view = screen('src/features/people/HelpRequestScreen.tsx', { id: 'other-user' }, 'own-user', {
    async addContact(id) { assert.equal(navigation.length, 0); added = id; },
  }, navigation);
  const checkIn = find(view, node => node.type === 'Pressable' && find(node, child => child.type === 'Text' && child.props.children === 'Check-in').length)[0];
  await checkIn.props.onPress();
  assert.equal(added, 'other-user');
  assert.equal(navigation.length, 1);
  assert.equal(navigation[0].pathname, '/network/check-in');
  assert.equal(navigation[0].params.guideId, 'other-user');
});

test('guidance Check-in reuses an existing contact and stays on the form if adding a new contact fails', async () => {
  for (const existing of [true, false]) {
    const navigation = [];
    let additions = 0;
    const view = screen('src/features/people/HelpRequestScreen.tsx', { id: 'other-user' }, 'own-user', {
      contactIds: existing ? ['other-user'] : [],
      async addContact() { additions++; throw new Error('Could not save contact'); },
    }, navigation);
    const checkIn = find(view, node => node.type === 'Pressable' && find(node, child => child.type === 'Text' && child.props.children === 'Check-in').length)[0];
    await checkIn.props.onPress();
    assert.equal(additions, existing ? 0 : 1);
    assert.equal(navigation.length, existing ? 1 : 0);
  }
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function screen(file, params, accountId, overrides = {}) {
  const jsx = (type, props) => ({ type, props });
  const guides = [{ id: 'own-user', name: 'Me', role: 'Engineer', expertise: [], listed: true },
    { id: 'other-user', name: 'Other graduate', role: 'Engineer', expertise: [], listed: true }];
  const network = { ready: true, loadError: '', contactIds: [], requests: [], inbox: [], messages: [], checkIns: [], incomingCheckIns: [], timeProposals: [], reload() {}, ...overrides };
  const imports = {
    react: { useState: initial => [initial, () => {}], useRef: initial => ({ current: initial }) },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'react-native': { Text: 'Text', View: 'View', Pressable: 'Pressable', TextInput: 'TextInput', StyleSheet: { create: value => value } },
    'expo-router': { useLocalSearchParams: () => params, router: {} },
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
  return module.exports.default ? module.exports.default() : module.exports.TimeProposalCard(params);
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
  const view = screen('src/features/network/NetworkScreen.tsx', {}, 'own-user', { incomingCheckIns: [meeting] });
  const labels = find(view, node => node.type === 'AppButton').map(node => node.props.label);
  const decline = labels.indexOf('Decline invitation');
  assert.ok(decline >= 0); assert.equal(labels[decline + 1], 'Reschedule and propose a new time');
});
test('pending proposal offers Accept/Reject only to the original sender', () => {
  const meeting = { id: 'meeting', status: 'pending', revision: 1 };
  const state = { timeProposals: [{ id: 'proposal', checkInId: 'meeting', baseRevision: 1, startsAt: new Date(Date.now() + 3600000).toISOString(), durationMinutes: 15, status: 'pending' }] };
  const sender = screen('src/features/network/TimeProposalCard.tsx', { meeting, owner: true, busy: false }, 'own-user', state);
  const recipient = screen('src/features/network/TimeProposalCard.tsx', { meeting, owner: false, busy: false }, 'other-user', state);
  assert.deepEqual(find(sender, node => node.type === 'AppButton').map(node => node.props.label), ['Accept new time', 'Reject new time']);
  assert.equal(find(recipient, node => node.type === 'AppButton').length, 0);
});

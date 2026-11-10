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

function mount() {
  const slots = [];
  let cursor = 0;
  let published;
  const react = {
    createContext: () => ({}),
    useEffect() {},
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
  };
  const jsx = (type, props) => ({ type, props });
  const imports = { react, 'react/jsx-runtime': { jsx, jsxs: jsx } };
  const { questionRules } = load('src/features/advice/AdviceProvider.tsx', {
    ...imports,
    './adviceApi': {},
    '../../data/sampleData': {},
  });
  const Screen = load('src/features/ask/AskScreen.tsx', {
    ...imports,
    'expo-router': { router: {}, useLocalSearchParams: () => ({}) },
    'react-native': { Platform: { OS: 'ios' }, Keyboard: { dismiss() {} },
      StyleSheet: { create: value => value }, Text: 'Text', TextInput: 'TextInput', View: 'View' },
    '../../theme': { theme: { colors: {}, spacing: {} } },
    '../advice/AdviceCard': {},
    '../advice/AdviceProvider': { questionRules, useAdvice: () => ({ posts: [], findPost() {},
      async postQuestion(draft) { published = draft; return { ...draft, id: 'posted' }; } }) },
    '../advice/search': { findSimilar: () => [] },
    '../advice/ui': Object.fromEntries(['ActionButton', 'AdviceScreen', 'Chip', 'ConfirmDialog', 'SectionLabel', 'TextLink']
      .map(name => [name, name]).concat([['announce', () => {}]])),
  }).default;
  let tree;
  const render = () => { cursor = 0; tree = Screen(); };
  const nodes = node => !node || typeof node !== 'object' ? []
    : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  const find = predicate => nodes(tree).find(predicate);
  const change = (label, value) => {
    find(node => node.props?.accessibilityLabel === label).props.onChangeText(value);
    render();
  };
  const press = async label => {
    await find(node => node.props?.label === label).props.onPress();
    render();
  };
  render();
  return { change, press, find, published: () => published };
}

test('a short title can be corrected to exactly 10 characters, reviewed, and published', async () => {
  const app = mount();
  await app.press('First job');
  app.change('Your question', 'Too short');
  await app.press('Review question →');
  assert.ok(app.find(node => node.props?.children === 'Before you can review your question:'));
  app.change('Your question', 'First job?');
  assert.equal(app.find(node => node.props?.children === 'Before you can review your question:'), undefined);
  await app.press('Review question →');
  assert.ok(app.find(node => node.props?.title === 'Look good?'));
  await app.press('Publish question');
  assert.equal(app.published().title, 'First job?');
});

test('correcting the title keeps a visible topic reminder until a topic is selected', async () => {
  const app = mount();
  app.change('Your question', 'Short');
  app.change('Question details', 'These details are longer than ten characters.');
  await app.press('Review question →');
  app.change('Your question', 'How do I prepare for work?');
  await app.press('Review question →');
  assert.ok(app.find(node => node.props?.children === 'Select a topic above: First job, Interviews, or Work life.'));
  await app.press('Work life');
  await app.press('Review question →');
  assert.ok(app.find(node => node.props?.title === 'Look good?'));
});

test('optional details and surrounding whitespace do not satisfy the title minimum', async () => {
  const app = mount();
  await app.press('Interviews');
  app.change('Your question', '  Short  ');
  app.change('Question details', 'These details are longer than ten characters.');
  await app.press('Review question →');
  assert.ok(app.find(node => node.props?.children === 'Before you can review your question:'));
  assert.equal(app.find(node => node.props?.title === 'Look good?'), undefined);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { exports: module.exports, require(name) {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected import: ${name}`);
  }});
  return module.exports;
}

const { questionAuthorLabel } = load('src/features/advice/questionAuthor.ts');

test('public authors use their profile name, with a fallback for missing names', () => {
  assert.equal(questionAuthorLabel({ visibility: 'Public', isMine: false, authorName: ' Cristiano Ronaldo ' }),
    'Posted by Cristiano Ronaldo');
  for (const authorName of [null, undefined, '', '   ']) {
    assert.equal(questionAuthorLabel({ visibility: 'Public', isMine: false, authorName }),
      'Posted by Community member');
  }
});

test('anonymous labels never expose a name, and ownership keeps the posted-by-you label', () => {
  assert.equal(questionAuthorLabel({ visibility: 'Anonymous', isMine: false, authorName: 'Private name' }),
    'Posted anonymously');
  assert.equal(questionAuthorLabel({ visibility: 'Anonymous', isMine: true, authorName: 'Private name' }),
    'Posted by you · anonymous');
  assert.equal(questionAuthorLabel({ visibility: 'Public', isMine: true, authorName: 'My name' }),
    'Posted by you');
});

function api(rows, profiles, profileError = null) {
  const calls = [];
  const client = {
    async rpc(name) {
      assert.equal(name, 'get_question_feed');
      return { data: rows, error: null };
    },
    from(table) {
      assert.equal(table, 'Profiles');
      return {
        select(columns) {
          assert.equal(columns, 'id, full_name');
          return { async in(column, ids) {
            assert.equal(column, 'id');
            calls.push([...ids]);
            return { data: profiles, error: profileError };
          } };
        },
      };
    },
  };
  return { calls, ...load('src/features/advice/adviceApi.ts', {
    '../../lib/supabase': { supabase: client },
  }) };
}

test('feed looks up public authors once and strips anonymous identity even from malformed feed data', async () => {
  const service = api([
    { id: 'public-one', visibility: 'Public', author_id: 'author-a' },
    { id: 'public-two', visibility: 'Public', author_id: 'author-a' },
    { id: 'anonymous', visibility: 'Anonymous', author_id: 'private-author', author_name: 'Private name' },
  ], [{ id: 'author-a', full_name: '  Public Author  ' }]);
  const rows = await service.fetchQuestions();
  assert.deepEqual(service.calls, [['author-a']]);
  assert.equal(rows[0].author_name, 'Public Author');
  assert.equal(rows[1].author_name, 'Public Author');
  assert.equal(rows[2].author_name, null);
  assert.equal(rows[2].author_id, null);
});

test('empty and anonymous-only feeds make no profile requests', async () => {
  for (const rows of [[], [{ id: 'anonymous', visibility: 'Anonymous', author_id: null }]]) {
    const service = api(rows, []);
    const result = await service.fetchQuestions();
    assert.equal(result.length, rows.length);
    assert.equal(service.calls.length, 0);
  }
});

test('missing profiles yield a fallback, while lookup failures remain retryable errors', async () => {
  const rows = [{ id: 'public', visibility: 'Public', author_id: 'missing' }];
  const missing = await api(rows, []).fetchQuestions();
  assert.equal(questionAuthorLabel({ visibility: 'Public', isMine: false, authorName: missing[0].author_name }),
    'Posted by Community member');
  await assert.rejects(api(rows, [], { message: 'Offline' }).fetchQuestions(), /question authors: Offline/);
});

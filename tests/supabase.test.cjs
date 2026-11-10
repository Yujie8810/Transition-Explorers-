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
const accountHelpers = load('src/features/auth/accountStore.ts');
const user = (id = 'account-a') => ({ id, email: `${id}@example.test`,
  user_metadata: { full_name: id, major: 'CS', affiliation: 'Student' } });
const signup = { name: 'New User', program: 'CS', affiliation: 'Graduate', email: ' NEW@example.test ', password: 'long-password' };

function mount(file, exported, imports, props = {}) {
  const slots = [], effects = [], cleanups = [];
  let cursor = 0;
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
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
  const jsx = (type, props) => ({ type, props });
  const component = load(file, { ...imports, react, 'react/jsx-runtime': { jsx, jsxs: jsx } })[exported];
  const render = () => {
    cursor = 0;
    const result = component({ children: null, ...props }).props.value;
    effects.splice(0).forEach(effect => effect());
    return result;
  };
  return { render, async ready() { render(); await new Promise(setImmediate); return render(); },
    unmount() { cleanups.forEach(cleanup => cleanup?.()); } };
}

function backend() {
  let callback, session = null;
  const rows = new Map();
  const api = { rows, error: null, signInError: null, confirmation: true, calls: [],
    emit(next) { session = next; callback?.(next ? 'SIGNED_IN' : 'SIGNED_OUT', next); },
    auth: {
      onAuthStateChange(cb) { callback = cb; return { data: { subscription: { unsubscribe() { callback = null; } } } }; },
      async getSession() { return { data: { session }, error: api.error }; },
      async signInWithPassword(input) {
        api.calls.push(['login', input]);
        if (api.signInError) return { error: api.signInError };
        const signedIn = user(); api.emit({ user: signedIn }); return { data: { user: signedIn }, error: null };
      },
      async signUp(input) {
        api.calls.push(['signup', input]);
        if (api.error) return { error: api.error };
        const registered = { ...user('new'), user_metadata: input.options.data };
        const next = api.confirmation ? null : { user: registered };
        if (next) api.emit(next);
        return { data: { user: registered, session: next }, error: null };
      },
      async signOut(input) {
        api.calls.push(['logout', input]);
        if (api.error) return { error: api.error };
        api.emit(null); return { error: null };
      },
      async updateUser(input) {
        if (!api.error) session.user.user_metadata = input.data;
        return { error: api.error };
      },
    },
    from(table) {
      assert.equal(table, 'Profiles');
      let id, change;
      const query = {
        select() { return query; },
        eq(column, value) { assert.equal(column, 'id'); id = value; return query; },
        async maybeSingle() { return { data: rows.get(id) ?? null, error: api.error }; },
        async single() {
          if (api.error) return { error: api.error };
          if (session?.user.id !== id || !rows.has(id)) return { error: new Error('Denied') };
          rows.set(id, { ...rows.get(id), ...change }); return { data: { id }, error: null };
        },
        update(value) { change = value; return query; },
        async upsert(value, options) {
          assert.equal(options.ignoreDuplicates, true);
          if (api.error) return { error: api.error };
          if (session?.user.id !== value.id) return { error: new Error('Denied') };
          if (!rows.has(value.id)) rows.set(value.id, value);
          return { error: null };
        },
      };
      return query;
    },
  };
  return api;
}
function authApp(api) {
  return mount('src/features/auth/AuthProvider.tsx', 'AuthProvider', {
    './accountStore': accountHelpers,
    '../../lib/supabase': { supabase: api, supabaseConfigurationError: 'Missing configuration' },
    'react-native': { Platform: { OS: 'web' } },
  });
}
function profileApp(api, id = 'account-a') {
  return mount('src/state/ProfileContext.tsx', 'ProfileProvider', { '../lib/supabase': { supabase: api } }, {
    accountId: id, initialProfile: { name: id, program: 'CS', affiliation: 'Student' },
  });
}

test('confirmation signup never opens a session; credential login, token refresh, logout and expiry update auth', async () => {
  const api = backend(), app = authApp(api);
  let auth = await app.ready();
  assert.equal(auth.ready, true); assert.equal(auth.account, null);
  assert.equal((await auth.signUp(signup)).needsConfirmation, true);
  assert.equal(app.render().account, null);
  assert.equal(api.calls[0][1].email, 'new@example.test');
  assert.equal(api.calls[0][1].options.data.full_name, 'New User');
  await app.render().signIn(' ACCOUNT-A@example.test ', 'password');
  auth = app.render(); assert.equal(auth.account.id, 'account-a');
  assert.equal(api.calls[1][1].password, 'password');
  const stable = auth.account;
  api.emit({ user: user() }); assert.equal(app.render().account, stable);
  api.error = new Error('Offline');
  await assert.rejects(app.render().signOut(), /Offline/);
  assert.equal(app.render().account.id, 'account-a');
  api.error = null;
  await app.render().signOut(); assert.equal(app.render().account, null);
  api.emit({ user: user('account-b') }); assert.equal(app.render().account.id, 'account-b');
  api.emit(null); assert.equal(app.render().account, null);
  app.unmount();
});

test('signup without confirmation and restored sessions use the backend user identity', async () => {
  const api = backend(); api.confirmation = false;
  const app = authApp(api); await app.ready();
  assert.equal((await app.render().signUp(signup)).needsConfirmation, false);
  assert.equal(app.render().account.id, 'new');
  app.unmount();
  const restart = authApp(api);
  assert.equal((await restart.ready()).account.id, 'new');
  restart.unmount();
});

test('invalid credentials and failed restoration expose recoverable errors', async () => {
  const api = backend(), app = authApp(api); await app.ready();
  api.signInError = new Error('Invalid login credentials');
  await assert.rejects(app.render().signIn('person@example.test', 'wrong'), /Invalid login/);
  assert.equal(app.render().account, null); assert.equal(app.render().busy, false);
  app.unmount();
  api.error = new Error('Offline');
  const failed = authApp(api);
  assert.equal((await failed.ready()).ready, false);
  assert.match(failed.render().loadError, /connection/);
  api.error = null; failed.render().reload();
  assert.equal((await failed.ready()).ready, true);
  failed.unmount();
  const missing = authApp(null);
  assert.match((await missing.ready()).loadError, /Missing configuration/);
});

test('profiles create missing rows, preserve existing data, persist edits and isolate users', async () => {
  const api = backend(); api.emit({ user: user() });
  const app = profileApp(api); let profile = await app.ready();
  assert.equal(profile.ready, true); assert.equal(api.rows.size, 1);
  await profile.updateProfile({ name: ' Edited ', program: ' Software ', affiliation: 'Graduate' });
  assert.equal(api.rows.get('account-a').full_name, 'Edited');
  assert.equal(app.render().profile.name, 'Edited');
  app.unmount();
  const restored = profileApp(api); const reloaded = await restored.ready();
  assert.equal(reloaded.profile.name, 'Edited'); assert.equal(reloaded.profile.affiliation, 'Graduate'); restored.unmount();
  api.emit({ user: user('account-b') });
  const second = profileApp(api, 'account-b');
  assert.equal((await second.ready()).profile.name, 'account-b');
  assert.equal(api.rows.get('account-a').full_name, 'Edited'); second.unmount();
});

test('profile read/write errors support retry and a stale account form cannot write', async () => {
  const api = backend(); api.emit({ user: user() }); api.error = new Error('Offline');
  const app = profileApp(api); assert.equal((await app.ready()).ready, false);
  assert.match(app.render().loadError, /retry/);
  api.error = null; app.render().reload(); let profile = await app.ready();
  assert.equal(profile.ready, true);
  api.error = new Error('Offline');
  await assert.rejects(profile.updateProfile({ name: 'Unsaved', program: 'CS', affiliation: 'Student' }), /Offline/);
  assert.equal(app.render().profile.name, 'account-a');
  api.error = null; api.emit({ user: user('account-b') });
  await assert.rejects(profile.updateProfile({ name: 'Wrong account', program: 'CS', affiliation: 'Student' }), /account changed/);
  assert.equal(api.rows.get('account-a').full_name, 'account-a'); app.unmount();
});

import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const env = process.env;
for (const name of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'TEST_A_EMAIL', 'TEST_A_PASSWORD', 'TEST_B_EMAIL', 'TEST_B_PASSWORD']) {
  if (!env[name]) throw new Error(`Required environment variable: ${name}`);
}
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const a = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, options);
const b = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, options);
const anonymous = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, options);
async function login(client, prefix) {
  const { data, error } = await client.auth.signInWithPassword({ email: env[`${prefix}_EMAIL`], password: env[`${prefix}_PASSWORD`] });
  assert.ifError(error);
  return data.user.id;
}
try {
  const aid = await login(a, 'TEST_A');
  const bid = await login(b, 'TEST_B');
  assert.notEqual(aid, bid, 'Two distinct users are required');
  const original = { title: `RLS test ${new Date().toISOString()}`, description: 'Disposable Task 3 security test', category: 'Бот', user_id: aid };
  const created = await a.from('requests').insert(original).select().single();
  assert.ifError(created.error);
  const id = created.data.id;
  console.log(`Test request ID: ${id}`);
  assert.equal(created.data.status, 'Новая');
  const foreign = await b.from('requests').select('*').eq('id', id);
  assert.ifError(foreign.error); assert.deepEqual(foreign.data, []);
  const edit = await b.from('requests').update({ title: 'Changed by B' }).eq('id', id).select();
  assert.ifError(edit.error); assert.deepEqual(edit.data, []);
  assert.ok((await b.from('requests').insert(original)).error, 'Foreign-owner insert must be rejected');
  assert.ok((await a.from('requests').update({ user_id: bid }).eq('id', id)).error, 'Ownership transfer must be rejected');
  assert.ok((await a.from('requests').insert({ ...original, status: 'В работе' })).error, 'Custom initial status must be rejected');
  const anonRead = await anonymous.from('requests').select('*').eq('id', id);
  assert.ok(anonRead.error || anonRead.data.length === 0, 'Anonymous access must not expose data');
  const own = await a.from('requests').select('*').eq('id', id).single();
  assert.ifError(own.error); assert.equal(own.data.title, original.title);
  const ownEdit = await a.from('requests').update({ status: 'В работе', description: 'Own update works' }).eq('id', id).select().single();
  assert.ifError(ownEdit.error); assert.equal(ownEdit.data.status, 'В работе');
  await a.auth.signOut(); await login(a, 'TEST_A');
  const persisted = await a.from('requests').select('*').eq('id', id).single();
  assert.ifError(persisted.error); assert.equal(persisted.data.description, 'Own update works');
  console.log('PASS: own create/update, initial status, relogin persistence, B read/update isolation, forged owner, ownership transfer, anonymous access.');
} finally {
  await Promise.all([a.auth.signOut(), b.auth.signOut()]);
}

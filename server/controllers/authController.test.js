const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Company = require('../models/Company');
const { register, login } = require('./authController');

const valid = () => ({ name: '  Test HR  ', email: '  HR@EXAMPLE.TEST  ', password: 'synthetic-password', companyName: '  Synthetic Company  ', companyDescription: '  Example description.  ' });

function setup(t) {
  const priorSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = randomUUID();
  t.after(() => { if (priorSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = priorSecret; });
  const state = { users: [], companies: [], userWrites: 0, companyWrites: 0, cleanups: 0 };
  t.mock.method(User, 'findOne', async (query) => state.users.find((u) => query.email instanceof RegExp ? query.email.test(u.email) : u.email === query.email));
  t.mock.method(Company, 'findOne', async (query) => state.companies.find((c) => c.name === query.name));
  t.mock.method(Company, 'create', async (data) => { state.companyWrites++; state.companies.push(data); return data; });
  t.mock.method(User, 'create', async (data) => { state.userWrites++; state.users.push(data); return data; });
  t.mock.method(User, 'exists', async (query) => state.users.find((u) => query._id ? String(u._id) === String(query._id) : String(u.companyId) === String(query.companyId)) || null);
  t.mock.method(Company, 'deleteOne', async (query) => {
    state.cleanups++;
    const index = state.companies.findIndex((c) => String(c._id) === String(query._id));
    if (index < 0) return { deletedCount: 0 };
    state.companies.splice(index, 1);
    return { deletedCount: 1 };
  });
  const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  return { state, res };
}

test('signup creates an isolated company and hashed HR account with a valid token', async (t) => {
  const { state, res } = setup(t);
  await register({ body: valid() }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(state.users[0].name, 'Test HR');
  assert.equal(state.users[0].email, 'hr@example.test');
  assert.equal(state.companies[0].name, 'Synthetic Company');
  assert.equal(state.companies[0].description, 'Example description.');
  assert.equal(String(state.users[0].companyId), String(state.companies[0]._id));
  assert.notEqual(state.users[0].password, valid().password);
  assert.equal(await bcrypt.compare(valid().password, state.users[0].password), true);
  const claims = jwt.verify(res.body.token, process.env.JWT_SECRET);
  assert.equal(claims.id, String(state.users[0]._id));
  assert.equal(claims.companyId, String(state.companies[0]._id));
  assert.equal(Object.hasOwn(res.body.user, 'password'), false);
  assert.equal(res.body.user.company.name, 'Synthetic Company');
});

const invalid = [
  ['missing body', undefined],
  ['existing company ID', { ...valid(), companyId: '111111111111111111111111' }],
  ['blank name', { ...valid(), name: '   ' }],
  ['non-string name', { ...valid(), name: {} }],
  ['long name', { ...valid(), name: 'a'.repeat(101) }],
  ['invalid email', { ...valid(), email: 'invalid' }],
  ['email object', { ...valid(), email: { $ne: null } }],
  ['short password', { ...valid(), password: '1234567' }],
  ['long password', { ...valid(), password: 'a'.repeat(73) }],
  ['multibyte password over bcrypt limit', { ...valid(), password: 'é'.repeat(37) }],
  ['missing password', { ...valid(), password: undefined }],
  ['missing company name', { ...valid(), companyName: '' }],
  ['long company name', { ...valid(), companyName: 'a'.repeat(101) }],
  ['blank company description', { ...valid(), companyDescription: '   ' }],
  ['long company description', { ...valid(), companyDescription: 'a'.repeat(2001) }]
];
for (const [label, body] of invalid) test(`signup rejects ${label} without creating records`, async (t) => {
  const { state, res } = setup(t);
  await register({ body }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(state.companyWrites + state.userWrites, 0);
});

test('signup rejects a duplicate email regardless of case, including regex punctuation', async (t) => {
  const { state, res } = setup(t);
  state.users.push({ email: 'HR+TEAM@EXAMPLE.TEST' });
  await register({ body: { ...valid(), email: 'hr+team@example.test' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(state.companyWrites, 0);
});

test('signup refuses an existing company without associating a new HR user', async (t) => {
  const { state, res } = setup(t);
  state.companies.push({ _id: 'existing', name: 'Synthetic Company' });
  await register({ body: valid() }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(state.companyWrites + state.userWrites, 0);
  assert.equal(state.companies[0]._id, 'existing');
});

test('failed user creation cleans up only the newly created company', async (t) => {
  const { state, res } = setup(t);
  state.companies.push({ _id: 'existing', name: 'Another company' });
  t.mock.method(User, 'create', async () => { throw new Error('Synthetic write failure'); });
  await register({ body: valid() }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(state.cleanups, 1);
  assert.deepEqual(state.companies, [{ _id: 'existing', name: 'Another company' }]);
  assert.equal(res.body.error, undefined);
});

test('lost user-write acknowledgement preserves the company and returns confirmed success', async (t) => {
  const { state, res } = setup(t);
  t.mock.method(User, 'create', async (data) => { state.users.push(data); throw new Error('Synthetic lost acknowledgement'); });
  await register({ body: valid() }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(state.cleanups, 0);
  assert.equal(state.companies.length, 1);
});

test('an unavailable persistence check preserves the company and reports an uncertain outcome', async (t) => {
  const { state, res } = setup(t);
  t.mock.method(User, 'create', async () => { throw new Error('Synthetic failure'); });
  t.mock.method(User, 'exists', async () => { throw new Error('Synthetic unavailable check'); });
  await register({ body: valid() }, res);
  assert.equal(res.statusCode, 500);
  assert.match(res.body.message, /could not be confirmed/);
  assert.equal(state.cleanups, 0);
  assert.equal(state.companies.length, 1);
});

test('unconfirmed company cleanup is reported instead of asking for an immediate retry', async (t) => {
  const { res } = setup(t);
  t.mock.method(User, 'create', async () => { throw new Error('Synthetic failure'); });
  t.mock.method(Company, 'deleteOne', async () => ({ deletedCount: 0 }));
  await register({ body: valid() }, res);
  assert.equal(res.statusCode, 500);
  assert.match(res.body.message, /contact support/);
});

test('duplicate-key races are reported as a conflict and the new company is cleaned up', async (t) => {
  const { state, res } = setup(t);
  t.mock.method(User, 'create', async () => { const error = new Error('Synthetic duplicate'); error.code = 11000; throw error; });
  await register({ body: valid() }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(state.companies.length, 0);
});

test('token configuration failure creates no company or user', async (t) => {
  const { state, res } = setup(t);
  delete process.env.JWT_SECRET;
  await register({ body: valid() }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(state.companyWrites + state.userWrites, 0);
});

test('login accepts a new account with mixed-case input and preserves the existing response shape', async (t) => {
  const { state, res } = setup(t);
  await register({ body: valid() }, res);
  const user = state.users[0];
  const queries = [];
  t.mock.method(User, 'findOne', (query) => ({ populate: async () => {
    queries.push(query.email);
    return query.email === user.email ? { ...user, companyId: state.companies[0] } : null;
  } }));
  await login({ body: { email: ' HR@EXAMPLE.TEST ', password: valid().password } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.company.name, 'Synthetic Company');
  assert.deepEqual(queries, ['HR@EXAMPLE.TEST', 'hr@example.test']);
});

test('legacy mixed-case login remains supported without changing the password', async (t) => {
  const { res } = setup(t);
  const company = { _id: 'company', name: 'Legacy Company' };
  const password = await bcrypt.hash('legacy-password', 10);
  t.mock.method(User, 'findOne', (query) => ({ populate: async () => query.email === 'Legacy@Example.test' ? { _id: 'legacy-user', name: 'Legacy', email: query.email, password, companyId: company } : null }));
  await login({ body: { email: 'Legacy@Example.test', password: 'legacy-password' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.company.name, 'Legacy Company');
});

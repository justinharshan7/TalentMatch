const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const { uploadsDirectory, resolveCVPath } = require('../utils/cvStorage');
const { withJobLock } = require('../utils/jobLifecycle');
const { deleteCandidate } = require('./candidateController');
const { deleteJob } = require('./jobController');
const originalUnlink = fs.unlink.bind(fs);
const ids = { app: '111111111111111111111111', other: '222222222222222222222222',
  job: '333333333333333333333333', company: '444444444444444444444444' };
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

async function setup(t) {
  const files = [];
  async function file() {
    await fs.mkdir(uploadsDirectory, { recursive: true });
    const p = path.join(uploadsDirectory, `application-deletion-test-${randomUUID()}.pdf`);
    files.push(p);
    await fs.writeFile(p, 'Synthetic disposable fixture');
    return `uploads/${path.basename(p)}`;
  }
  t.after(async () => {
    for (const p of files) try { await originalUnlink(p); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  });
  const records = [
    { _id: ids.app, job: ids.job, company: ids.company, cvPath: await file() },
    { _id: ids.other, job: ids.job, company: ids.company, cvPath: await file() }
  ];
  let job = { _id: ids.job, company: ids.company, isDeleting: false,
    async save() {}, async deleteOne() { job = null; return { deletedCount: 1 }; } };
  t.mock.method(Candidate, 'findById', async (id) => records.find(r => r._id === id) || null);
  t.mock.method(Job, 'findById', async () => job);
  t.mock.method(Candidate, 'find', (filter) => {
    const result = filter._id ? records.filter(r => r._id !== filter._id.$ne)
      : typeof filter.job === 'object' ? records.filter(r => r.job !== filter.job.$ne)
        : records.filter(r => r.job === filter.job);
    const promise = Promise.resolve(result);
    promise.select = async () => result;
    return promise;
  });
  t.mock.method(Candidate, 'deleteOne', async (filter) => {
    const index = records.findIndex(r => Object.entries(filter).every(([key, value]) => r[key] === value));
    if (index < 0) return { deletedCount: 0 };
    records.splice(index, 1);
    return { deletedCount: 1 };
  });
  return { records, file, get job() { return job; }, set job(value) { job = value; },
    req: { params: { id: ids.app }, user: { companyId: ids.company } } };
}

test('deletes only the owned application and CV, preserving job and other application', async t => {
  const c = await setup(t); const removed = resolveCVPath(c.records[0].cvPath); const other = c.records[1];
  const res = response(); await deleteCandidate(c.req, res);
  assert.equal(res.statusCode, 200); assert.deepEqual(c.records, [other]); assert.ok(c.job);
  await assert.rejects(fs.access(removed), { code: 'ENOENT' }); await fs.access(resolveCVPath(other.cvPath));
});

for (const [label, change, status] of [
  ['no user', c => { delete c.req.user; }, 401],
  ['no company', c => { c.req.user = {}; }, 403],
  ['foreign company', c => { c.req.user.companyId = ids.other; }, 403],
  ['invalid ID', c => { c.req.params.id = 'invalid'; }, 400],
  ['missing application', c => { c.req.params.id = '999999999999999999999999'; }, 404],
  ['foreign job', c => { c.job.company = ids.other; }, 409],
  ['missing job', c => { c.job = null; }, 409],
  ['deleting job', c => { c.job.isDeleting = true; }, 409]
]) test(`${label}: leaves records and files untouched`, async t => {
  const c = await setup(t); change(c); const res = response();
  await deleteCandidate(c.req, res); assert.equal(res.statusCode, status); assert.equal(c.records.length, 2);
  for (const r of c.records) await fs.access(resolveCVPath(r.cvPath));
});

test('ownership is rechecked after waiting for the job lock', async t => {
  const c = await setup(t); const original = Candidate.findById.bind(Candidate); let reads = 0;
  t.mock.method(Candidate, 'findById', async id => {
    const r = await original(id); if (++reads === 2) r.company = ids.other; return r;
  });
  const res = response(); await deleteCandidate(c.req, res);
  assert.equal(res.statusCode, 403); assert.equal(c.records.length, 2);
  await fs.access(resolveCVPath(c.records[0].cvPath));
});

test('shared CV using alternate path separators is protected', async t => {
  const c = await setup(t); c.records[1].cvPath = c.records[0].cvPath.replace(/\//g, '\\');
  const res = response(); await deleteCandidate(c.req, res);
  assert.equal(res.statusCode, 409); assert.match(res.body.message, /shared/); assert.equal(c.records.length, 2);
  await fs.access(resolveCVPath(c.records[0].cvPath));
});

test('missing CV permits deleting its application', async t => {
  const c = await setup(t); await originalUnlink(resolveCVPath(c.records[0].cvPath));
  const res = response(); await deleteCandidate(c.req, res);
  assert.equal(res.statusCode, 200); assert.match(res.body.message, /already missing/); assert.equal(c.records.length, 1);
});

for (const stage of ['unsafe path', 'file failure', 'shared-reference query failure']) {
  test(`${stage}: application stays and success is not claimed`, async t => {
    const c = await setup(t);
    if (stage === 'unsafe path') c.records[0].cvPath = 'uploads/../server.js';
    if (stage === 'file failure') t.mock.method(fs, 'unlink', async () => { throw new Error('Synthetic failure'); });
    if (stage === 'shared-reference query failure') t.mock.method(Candidate, 'find', () => ({ select: async () => { throw new Error('Synthetic failure'); } }));
    const res = response(); await deleteCandidate(c.req, res);
    assert.equal(res.statusCode, 500); assert.equal(res.body.cvCleanupCompleted, false); assert.equal(c.records.length, 2);
  });
}

for (const mode of ['throw', 'zero']) test(`database ${mode} after CV removal reports partial cleanup and supports retry`, async t => {
  const c = await setup(t); const remove = Candidate.deleteOne.bind(Candidate); let fail = true;
  t.mock.method(Candidate, 'deleteOne', async filter => {
    if (fail) { fail = false; if (mode === 'throw') throw new Error('Synthetic database failure'); return { deletedCount: 0 }; }
    return remove(filter);
  });
  const res = response(); await deleteCandidate(c.req, res);
  assert.equal(res.statusCode, 500); assert.equal(res.body.cvCleanupCompleted, true); assert.equal(c.records.length, 2);
  await assert.rejects(fs.access(resolveCVPath(c.records[0].cvPath)), { code: 'ENOENT' });
  const retry = response(); await deleteCandidate(c.req, retry); assert.equal(retry.statusCode, 200); assert.equal(c.records.length, 1);
});

test('repeated concurrent deletion removes the application once', async t => {
  const c = await setup(t); const a = response(); const b = response();
  await Promise.all([deleteCandidate(c.req, a), deleteCandidate(c.req, b)]);
  assert.deepEqual([a.statusCode, b.statusCode].sort(), [200, 404]); assert.equal(c.records.length, 1);
});

for (const first of ['application', 'job']) test(`${first} deletion first coordinates with the other deletion`, async t => {
  const c = await setup(t); const app = response(); const job = response();
  const jobReq = { params: { id: ids.job }, user: c.req.user, body: { expectedApplicationCount: 2 } };
  // Queue both operations behind the same lock, in a deterministic order.
  let release; const gate = new Promise(resolve => { release = resolve; });
  const held = withJobLock(ids.job, () => gate);
  let applicationTask; let jobTask;
  if (first === 'application') {
    applicationTask = deleteCandidate(c.req, app);
    await new Promise(resolve => setImmediate(resolve));
    jobTask = deleteJob(jobReq, job);
  } else {
    jobTask = deleteJob(jobReq, job);
    applicationTask = deleteCandidate(c.req, app);
  }
  release(); await Promise.all([held, applicationTask, jobTask]);
  assert.equal(app.statusCode, first === 'application' ? 200 : 404);
  assert.equal(job.statusCode, first === 'application' ? 409 : 200);
  assert.equal(c.records.length, first === 'application' ? 1 : 0);
  assert.equal(!!c.job, first === 'application');
});

test('DELETE route requires authentication before database access', async () => {
  const server = require('../server').listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/candidates/${ids.app}`, { method: 'DELETE' });
    assert.equal(res.status, 401); await res.body.cancel();
  } finally { await new Promise(resolve => server.close(resolve)); }
});

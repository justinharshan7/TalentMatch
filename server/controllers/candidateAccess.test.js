const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const { uploadsDirectory } = require('../utils/cvStorage');

// Import the real route configuration, using synthetic authentication and mocked
// database reads. Never connect to MongoDB or print tokens/file contents.
process.env.JWT_SECRET = randomUUID();
const app = require('../server');
const ids = {
  company: '111111111111111111111111', foreignCompany: '222222222222222222222222',
  job: '333333333333333333333333', candidate: '444444444444444444444444',
  user: '555555555555555555555555', foreignUser: '666666666666666666666666',
  missing: '999999999999999999999999'
};
let server;
let baseURL;
before(async () => {
  server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((resolve) => server.close(resolve)); });

async function setup(t, extension = '.pdf') {
  await fs.mkdir(uploadsDirectory, { recursive: true });
  const filename = `candidate-access-test-${randomUUID()}${extension}`;
  const filePath = path.join(uploadsDirectory, filename);
  const bytes = Buffer.from('Disposable synthetic CV fixture.');
  await fs.writeFile(filePath, bytes);
  t.after(async () => {
    try { await fs.unlink(filePath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  });
  const candidate = {
    _id: ids.candidate, job: ids.job, company: ids.company,
    name: 'Synthetic Candidate', cvPath: `uploads\\${filename}`,
    scores: { skills: 400, education: 200, experience: 100, certifications: 0, softSkills: 0, total: 700 },
    status: 'shortlisted',
    async populate() { return this; }
  };
  const candidateReads = [];
  t.mock.method(User, 'findById', (id) => ({ select: async () => ({
    _id: id, companyId: id === ids.foreignUser ? ids.foreignCompany : ids.company
  }) }));
  t.mock.method(Job, 'findById', async (id) => id === ids.job ? { _id: ids.job, company: ids.company } : null);
  t.mock.method(Candidate, 'findById', async (id) => id === ids.candidate ? candidate : null);
  t.mock.method(Candidate, 'find', (filter) => {
    candidateReads.push(filter);
    return { sort: async (order) => {
      assert.deepEqual(order, { 'scores.total': -1 });
      return filter.job === ids.job && filter.company === ids.company ? [candidate] : [];
    } };
  });
  const request = (route, company = 'owner', options = {}) => {
    const headers = {};
    if (company) {
      const token = jwt.sign({ id: company === 'foreign' ? ids.foreignUser : ids.user }, process.env.JWT_SECRET, { expiresIn: '1m' });
      headers.Authorization = `Bearer ${token}`;
    }
    return fetch(`${baseURL}${route}`, { headers, signal: AbortSignal.timeout(5000), ...options });
  };
  return { candidate, candidateReads, filename, filePath, bytes, request };
}

const endpoints = [
  ['list', `/api/candidates/job/${ids.job}`],
  ['detail', `/api/candidates/${ids.candidate}`],
  ['CV', `/api/candidates/${ids.candidate}/cv`]
];

for (const [label, endpoint] of endpoints) {
  test(`${label}: owning company succeeds`, async (t) => {
    const context = await setup(t);
    const response = await context.request(endpoint);
    assert.equal(response.status, 200);
    if (label === 'CV') {
      assert.equal(response.headers.get('content-type'), 'application/pdf');
      assert.match(response.headers.get('cache-control'), /private.*no-store/);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), context.bytes);
    } else {
      const data = await response.json();
      assert.equal((label === 'list' ? data[0] : data)._id, ids.candidate);
      assert.deepEqual((label === 'list' ? data[0] : data).scores, context.candidate.scores);
      assert.equal((label === 'list' ? data[0] : data).status, context.candidate.status);
      if (label === 'list') assert.deepEqual(context.candidateReads, [{ job: ids.job, company: ids.company }]);
    }
  });

  test(`${label}: foreign company is denied`, async (t) => {
    const context = await setup(t);
    const response = await context.request(endpoint, 'foreign');
    assert.equal(response.status, 403);
    assert.match((await response.json()).message, /another company/);
    assert.deepEqual(context.candidateReads, []);
  });

  test(`${label}: missing token is denied`, async (t) => {
    const context = await setup(t);
    const response = await context.request(endpoint, null);
    assert.equal(response.status, 401);
    await response.body.cancel();
  });

  test(`${label}: invalid token is denied`, async (t) => {
    const context = await setup(t);
    const response = await context.request(endpoint, null, { headers: { Authorization: 'Bearer invalid-fixture-token' } });
    assert.equal(response.status, 401);
    await response.body.cancel();
  });

  test(`${label}: expired token is denied`, async (t) => {
    const context = await setup(t);
    const token = jwt.sign({ id: ids.user }, process.env.JWT_SECRET, { expiresIn: -1 });
    const response = await context.request(endpoint, null, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 401);
    await response.body.cancel();
  });

  test(`${label}: token for removed account is denied`, async (t) => {
    const context = await setup(t);
    t.mock.method(User, 'findById', () => ({ select: async () => null }));
    const response = await context.request(endpoint);
    assert.equal(response.status, 401);
    await response.body.cancel();
  });

  test(`${label}: account without company is denied`, async (t) => {
    const context = await setup(t);
    t.mock.method(User, 'findById', () => ({ select: async () => ({ _id: ids.user }) }));
    const response = await context.request(endpoint);
    assert.equal(response.status, 403);
    await response.body.cancel();
  });

  test(`${label}: malformed ID returns 400`, async (t) => {
    const context = await setup(t);
    const route = label === 'list' ? '/api/candidates/job/not-an-id' : `/api/candidates/not-an-id${label === 'CV' ? '/cv' : ''}`;
    const response = await context.request(route);
    assert.equal(response.status, 400);
    await response.body.cancel();
  });

  test(`${label}: missing record returns 404`, async (t) => {
    const context = await setup(t);
    const route = label === 'list' ? `/api/candidates/job/${ids.missing}` : `/api/candidates/${ids.missing}${label === 'CV' ? '/cv' : ''}`;
    const response = await context.request(route);
    assert.equal(response.status, 404);
    await response.body.cancel();
  });

  test(`${label}: database failure returns a safe 500 response`, async (t) => {
    const context = await setup(t);
    t.mock.method(label === 'list' ? Job : Candidate, 'findById', async () => { throw new Error('Synthetic database failure'); });
    const response = await context.request(endpoint);
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.ok(body.message);
    assert.equal(body.error, undefined);
  });
}

test('protected CV serves DOCX with the correct MIME type', async (t) => {
  const context = await setup(t, '.docx');
  const response = await context.request(`/api/candidates/${ids.candidate}/cv`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), context.bytes);
});

test('missing CV file returns 404', async (t) => {
  const context = await setup(t);
  context.candidate.cvPath = `uploads/missing-${randomUUID()}.pdf`;
  const response = await context.request(`/api/candidates/${ids.candidate}/cv`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).message, 'CV file not found');
});

test('client-supplied file paths are ignored', async (t) => {
  const context = await setup(t);
  const response = await context.request(`/api/candidates/${ids.candidate}/cv?path=../server.js&cvPath=../server.js`);
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), context.bytes);
});

test('unsafe stored path returns 500 without exposing another file', async (t) => {
  const context = await setup(t);
  context.candidate.cvPath = 'uploads/../server.js';
  const response = await context.request(`/api/candidates/${ids.candidate}/cv`);
  assert.equal(response.status, 500);
  assert.equal((await response.json()).message, 'Unable to read CV file safely');
});

test('symlink/non-regular CV is refused', async (t) => {
  const context = await setup(t);
  t.mock.method(fs, 'lstat', async () => ({ isFile: () => false, isSymbolicLink: () => true }));
  const response = await context.request(`/api/candidates/${ids.candidate}/cv`);
  assert.equal(response.status, 500);
  await response.body.cancel();
});

test('redirected uploads directory is refused', async (t) => {
  const context = await setup(t);
  t.mock.method(fs, 'realpath', async () => path.resolve(uploadsDirectory, '../elsewhere'));
  const response = await context.request(`/api/candidates/${ids.candidate}/cv`);
  assert.equal(response.status, 500);
  await response.body.cancel();
});

test('file permission error returns a safe 500', async (t) => {
  const context = await setup(t);
  t.mock.method(fs, 'lstat', async () => { throw Object.assign(new Error('Synthetic permission failure'), { code: 'EACCES' }); });
  const response = await context.request(`/api/candidates/${ids.candidate}/cv`);
  assert.equal(response.status, 500);
  assert.equal((await response.json()).message, 'Unable to read CV file safely');
});

test('old public upload URL serves no file, with or without authentication', async (t) => {
  const context = await setup(t);
  for (const company of [null, 'owner']) {
    const response = await context.request(`/uploads/${context.filename}`, company);
    assert.equal(response.status, 404);
    const body = Buffer.from(await response.arrayBuffer());
    assert.notDeepEqual(body, context.bytes);
  }
});

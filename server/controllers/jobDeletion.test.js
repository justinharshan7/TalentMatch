const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const processor = require('../utils/cvProcessor');
const { withJobLock } = require('../utils/jobLifecycle');
const { uploadsDirectory, resolveCVPath, removeCV } = require('../utils/cvStorage');
const { deleteJob, getDeletionInfo, getJobs, getJob, getMyJobs, updateJob } = require('./jobController');
const { submitApplication } = require('./candidateController');
const originalUnlink = fs.unlink.bind(fs);

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

async function setup(t, count = 1) {
  const files = [];
  const applications = [];
  let storedJob = { _id: 'job-1', company: 'company-1', title: 'Original', requirements: { skills: ['Java'] }, isDeleting: false };
  const events = [];
  async function file() {
    await fs.mkdir(uploadsDirectory, { recursive: true });
    const filename = `deletion-test-${randomUUID()}.pdf`;
    const absolute = path.join(uploadsDirectory, filename);
    files.push(absolute);
    await fs.writeFile(absolute, 'test CV');
    return `uploads/${filename}`;
  }
  t.after(async () => {
    for (const filename of files) {
      try { await originalUnlink(filename); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  });
  for (let index = 0; index < count; index++) {
    applications.push({ _id: `app-${index}`, job: 'job-1', company: 'company-1', cvPath: await file() });
  }
  const document = () => {
    if (!storedJob) return null;
    return {
      ...structuredClone(storedJob),
      async save() {
        events.push('save-job');
        storedJob = { ...storedJob, isDeleting: this.isDeleting };
        return this;
      },
      async deleteOne() { events.push('delete-job'); storedJob = null; return { deletedCount: 1 }; }
    };
  };
  t.mock.method(Job, 'findById', () => {
    const query = Promise.resolve(document());
    query.populate = async () => {
      const job = document();
      if (job) job.company = { _id: storedJob.company, name: 'Fixture Company' };
      return job;
    };
    return query;
  });
  t.mock.method(Candidate, 'countDocuments', async ({ job }) => applications.filter((app) => app.job === job).length);
  t.mock.method(Candidate, 'find', async ({ job }) => applications.filter((app) => (
    typeof job === 'object' ? app.job !== job.$ne : app.job === job
  )));
  t.mock.method(Candidate, 'deleteOne', async ({ _id, job }) => {
    const index = applications.findIndex((app) => app._id === _id && app.job === job);
    if (index < 0) return { deletedCount: 0 };
    events.push(`delete-${_id}`);
    applications.splice(index, 1);
    return { deletedCount: 1 };
  });
  t.mock.method(Candidate, 'exists', async ({ cvPath }) => applications.some((app) => app.cvPath === cvPath));
  return {
    applications, events, file, document,
    get job() { return storedJob; },
    request: (expectedApplicationCount = count) => ({
      params: { id: 'job-1' }, user: { companyId: 'company-1' }, body: { expectedApplicationCount }
    })
  };
}

test('count check is read-only, includes only this job, and does not mark deletion', async (t) => {
  const context = await setup(t, 2);
  context.applications.push({ _id: 'other', job: 'job-2', cvPath: await context.file() });
  const before = structuredClone(context.applications);
  const res = response();
  await getDeletionInfo(context.request(), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { applicationCount: 2, isDeleting: false });
  assert.deepEqual(context.applications, before);
  assert.equal(context.job.isDeleting, false);
  assert.deepEqual(context.events, []);
});

for (const controller of [getDeletionInfo, deleteJob]) {
  test(`${controller.name}: ownership failure changes no records or files`, async (t) => {
    const context = await setup(t);
    const req = context.request();
    req.user.companyId = 'company-2';
    const res = response();
    await controller(req, res);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(context.events, []);
    await fs.access(resolveCVPath(context.applications[0].cvPath));
  });
  test(`${controller.name}: missing job returns 404`, async (t) => {
    const context = await setup(t, 0);
    t.mock.method(Job, 'findById', async () => null);
    const res = response();
    await controller(context.request(), res);
    assert.equal(res.statusCode, 404);
    assert.deepEqual(context.events, []);
  });
}

for (const count of [0, 2]) {
  test(`deletes job with ${count} applications, only its records/files, job last`, async (t) => {
    const context = await setup(t, count);
    const ownFiles = context.applications.map((app) => resolveCVPath(app.cvPath));
    if (count) context.applications[0].cvPath = context.applications[0].cvPath.replace(/\//g, '\\');
    const other = { _id: 'other', job: 'job-2', company: 'company-2', cvPath: await context.file() };
    context.applications.push(other);
    const res = response();
    await deleteJob(context.request(), res);
    assert.equal(res.statusCode, 200);
    assert.equal(context.job, null);
    assert.deepEqual(context.applications, [other]);
    assert.equal(context.events.at(-1), 'delete-job');
    for (const filename of ownFiles) await assert.rejects(fs.access(filename), { code: 'ENOENT' });
    await fs.access(resolveCVPath(other.cvPath));
  });
}

test('missing CV is treated as already cleaned', async (t) => {
  const context = await setup(t);
  await originalUnlink(resolveCVPath(context.applications[0].cvPath));
  const res = response();
  await deleteJob(context.request(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(context.job, null);
  assert.match(res.body.message, /already absent/);
});

for (const value of [undefined, -1, 1.5, '1', 0]) {
  test(`invalid or changed confirmed count ${String(value)} never starts cleanup`, async (t) => {
    const context = await setup(t);
    const req = context.request();
    req.body.expectedApplicationCount = value;
    const res = response();
    await deleteJob(req, res);
    assert.equal(res.statusCode, value === 0 ? 409 : 400);
    assert.deepEqual(context.events, []);
    assert.equal(context.job.isDeleting, false);
    await fs.access(resolveCVPath(context.applications[0].cvPath));
  });
}

test('shared legacy CV referenced by another job is never removed', async (t) => {
  const context = await setup(t);
  const sharedPath = context.applications[0].cvPath;
  context.applications.push({ _id: 'other', job: 'job-2', cvPath: sharedPath.replace(/\//g, '\\') });
  const res = response();
  await deleteJob(context.request(), res);
  assert.equal(res.statusCode, 500);
  assert.equal(context.job.isDeleting, true);
  assert.match(res.body.message, /another job/);
  assert.equal(context.applications.length, 2);
  await fs.access(resolveCVPath(sharedPath));
});

test('unsafe stored path prevents application/job removal', async (t) => {
  const context = await setup(t);
  context.applications[0].cvPath = 'uploads/../outside.pdf';
  const res = response();
  await deleteJob(context.request(), res);
  assert.equal(res.statusCode, 500);
  assert.equal(context.applications.length, 1);
  assert.equal(context.job.isDeleting, true);
});

test('inconsistent application company stops cleanup', async (t) => {
  const context = await setup(t);
  context.applications[0].company = 'company-2';
  const res = response();
  await deleteJob(context.request(), res);
  assert.equal(res.statusCode, 500);
  assert.equal(context.applications.length, 1);
  await fs.access(resolveCVPath(context.applications[0].cvPath));
});

for (const stage of ['file', 'application-db', 'job-db']) {
  test(`${stage} failure reports partial cleanup, releases lock, and allows retry`, async (t) => {
    const context = await setup(t, 2);
    let fail = true;
    if (stage === 'file') {
      const failingPath = resolveCVPath(context.applications[1].cvPath);
      t.mock.method(fs, 'unlink', async (filename) => {
        if (fail && filename === failingPath) throw Object.assign(new Error('Permission denied'), { code: 'EACCES' });
        return originalUnlink(filename);
      });
    } else if (stage === 'application-db') {
      const previous = Candidate.deleteOne;
      t.mock.method(Candidate, 'deleteOne', async (filter) => {
        if (fail) throw new Error('Application database failure');
        return previous(filter);
      });
    } else {
      const previous = Job.findById;
      t.mock.method(Job, 'findById', async () => {
        const doc = await previous();
        const remove = doc.deleteOne;
        doc.deleteOne = async () => {
          if (fail) throw new Error('Job database failure');
          return remove();
        };
        return doc;
      });
    }
    const first = response();
    await deleteJob(context.request(), first);
    assert.equal(first.statusCode, 500);
    assert.equal(first.body.deletionIncomplete, true);
    assert.equal(context.job.isDeleting, true);
    fail = false;
    const retry = response();
    await deleteJob(context.request(context.applications.length), retry);
    assert.equal(retry.statusCode, 200);
    assert.equal(context.job, null);
    assert.equal(context.applications.length, 0);
  });
}

test('failure to persist deletion flag performs no file/application cleanup', async (t) => {
  const context = await setup(t);
  t.mock.method(Job, 'findById', async () => ({
    ...context.document(), save: async () => { throw new Error('Database unavailable'); }
  }));
  const res = response();
  await deleteJob(context.request(), res);
  assert.equal(res.statusCode, 500);
  assert.equal(context.job.isDeleting, false);
  assert.equal(context.applications.length, 1);
  await fs.access(resolveCVPath(context.applications[0].cvPath));
});

test('pre-existing persisted deletion flag supports retry without earlier in-memory state', async (t) => {
  const context = await setup(t);
  context.job.isDeleting = true;
  const res = response();
  await deleteJob(context.request(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(context.job, null);
});

test('deleting jobs reject edits without saving', async (t) => {
  const context = await setup(t, 0);
  context.job.isDeleting = true;
  const req = context.request();
  req.body = { title: 'Changed title', description: 'Changed', requirements: { skills: ['Java'] } };
  const res = response();
  await updateJob(req, res);
  assert.equal(res.statusCode, 409);
  assert.equal(context.job.title, 'Original');
  assert.deepEqual(context.events, []);
});

test('public queries hide deleting jobs while company management retains them', async (t) => {
  const context = await setup(t, 0);
  context.job.isDeleting = true;
  const queries = [];
  t.mock.method(Job, 'find', (filter) => {
    queries.push(filter);
    return { populate: async () => filter.company ? [context.job] : [] };
  });
  const listing = response();
  await getJobs({}, listing);
  assert.deepEqual(queries[0], { isDeleting: { $ne: true } });
  assert.deepEqual(listing.body, []);
  const detail = response();
  await getJob(context.request(), detail);
  assert.equal(detail.statusCode, 404);
  const management = response();
  await getMyJobs(context.request(), management);
  assert.equal(management.body[0].isDeleting, true);
});

test('lock serializes the same job, permits other jobs, and releases on throw', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const events = [];
  const first = withJobLock('LOCK-TEST', async () => { events.push('first'); await gate; throw new Error('expected'); });
  const firstFailure = assert.rejects(first, /expected/);
  const second = withJobLock('lock-test', async () => { events.push('second'); });
  await withJobLock('another-job', async () => { events.push('other'); });
  assert.deepEqual(events, ['first', 'other']);
  release();
  await Promise.all([firstFailure, second]);
  assert.deepEqual(events, ['first', 'other', 'second']);
});

test('path resolver accepts Windows separators/absolute uploads paths and rejects escapes', () => {
  assert.equal(resolveCVPath('uploads\\test.pdf'), path.join(uploadsDirectory, 'test.pdf'));
  assert.equal(resolveCVPath(path.join(uploadsDirectory, 'test.pdf')), path.join(uploadsDirectory, 'test.pdf'));
  for (const unsafe of ['uploads/../secret.pdf', '../secret.pdf', '/tmp/secret.pdf', 'uploads/sub/file.pdf', 'uploads', '', null]) {
    assert.throws(() => resolveCVPath(unsafe));
  }
});

test('file cleanup rejects non-regular files before unlink', async (t) => {
  t.mock.method(fs, 'lstat', async () => ({ isFile: () => false, isSymbolicLink: () => true }));
  let unlinked = false;
  t.mock.method(fs, 'unlink', async () => { unlinked = true; });
  await assert.rejects(removeCV('uploads/fake.pdf'), /non-regular/);
  assert.equal(unlinked, false);
});

for (const deleting of [true, false]) {
  test(`application with deleting=${deleting}: ${deleting ? 'rejects and cleans upload' : 'preserves existing scoring and saves relative CV path'}`, async (t) => {
    const context = await setup(t, 0);
    context.job.isDeleting = deleting;
    const cvPath = await context.file();
    t.mock.method(processor, 'extractText', async () => 'Java');
    let created;
    t.mock.method(Candidate, 'create', async (data) => { created = { _id: 'new-app', ...data }; return created; });
    const req = { body: { jobId: 'job-1', name: 'Candidate', email: 'candidate@example.com' }, file: { path: resolveCVPath(cvPath) } };
    const res = response();
    await submitApplication(req, res);
    assert.equal(res.statusCode, deleting ? 409 : 201);
    if (deleting) {
      assert.equal(created, undefined);
      await assert.rejects(fs.access(req.file.path), { code: 'ENOENT' });
    } else {
      assert.equal(created.cvPath, cvPath);
      assert.equal(created.scores.total, 400);
      assert.equal(created.status, 'rejected');
      assert.deepEqual(res.body, {
        message: 'Application submitted successfully', jobTitle: 'Original', companyName: 'Fixture Company'
      });
      await fs.access(req.file.path);
    }
  });
}

test('shortlisted application stores all calculated scores but returns only confirmation data', async (t) => {
  const context = await setup(t, 0);
  context.job.title = 'Senior Engineer';
  context.job.requirements = {
    skills: ['Java'], education: ['degree'], experience: ['experience'],
    certifications: ['certified'], softSkills: ['teamwork']
  };
  const cvPath = await context.file();
  t.mock.method(processor, 'extractText', async () => 'Java degree experience certified teamwork');
  let created;
  t.mock.method(Candidate, 'create', async (data) => { created = { _id: 'new-app', ...data }; return created; });
  const res = response();
  await submitApplication({
    body: { jobId: 'job-1', name: 'Fixture', email: 'fixture@example.test' },
    file: { path: resolveCVPath(cvPath) }
  }, res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(created.scores, {
    skills: 400, education: 200, experience: 200, certifications: 100, softSkills: 100, total: 1000
  });
  assert.equal(created.status, 'shortlisted');
  assert.equal(created.company, 'company-1');
  assert.equal(created.job, 'job-1');
  assert.deepEqual(res.body, {
    message: 'Application submitted successfully', jobTitle: 'Senior Engineer', companyName: 'Fixture Company'
  });
  await fs.access(resolveCVPath(cvPath));
});

test('application queued behind deletion is rejected and its new upload is cleaned', async (t) => {
  const context = await setup(t, 0);
  const cvPath = await context.file();
  const req = { body: { jobId: 'job-1' }, file: { path: resolveCVPath(cvPath) } };
  const deleted = response();
  const applied = response();
  await Promise.all([deleteJob(context.request(), deleted), submitApplication(req, applied)]);
  assert.equal(deleted.statusCode, 200);
  assert.equal(applied.statusCode, 404);
  await assert.rejects(fs.access(req.file.path), { code: 'ENOENT' });
});

test('application queued first changes count and prevents unconfirmed deletion', async (t) => {
  const context = await setup(t, 0);
  const cvPath = await context.file();
  t.mock.method(processor, 'extractText', async () => 'Java');
  t.mock.method(Candidate, 'create', async (data) => {
    const candidate = { _id: 'new-app', ...data };
    context.applications.push(candidate);
    return candidate;
  });
  const applied = response();
  const deleted = response();
  await Promise.all([
    submitApplication({ body: { jobId: 'job-1', name: 'Candidate', email: 'candidate@example.com' }, file: { path: resolveCVPath(cvPath) } }, applied),
    deleteJob(context.request(0), deleted)
  ]);
  assert.equal(applied.statusCode, 201);
  assert.equal(deleted.statusCode, 409);
  assert.equal(context.job.isDeleting, false);
  assert.equal(context.applications.length, 1);
  await fs.access(resolveCVPath(cvPath));
});

test('rejected-upload cleanup failure is reported, not hidden', async (t) => {
  const context = await setup(t, 0);
  context.job.isDeleting = true;
  const cvPath = await context.file();
  t.mock.method(fs, 'unlink', async () => { throw new Error('Permission denied'); });
  const res = response();
  await submitApplication({ body: { jobId: 'job-1' }, file: { path: resolveCVPath(cvPath) } }, res);
  assert.equal(res.statusCode, 500);
  assert.match(res.body.message, /cleanup could not be completed/);
});

test('failed application-count request is read-only and returns an error', async (t) => {
  const context = await setup(t);
  t.mock.method(Candidate, 'countDocuments', async () => { throw new Error('Database unavailable'); });
  const res = response();
  await getDeletionInfo(context.request(), res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(context.events, []);
  assert.equal(context.job.isDeleting, false);
});

test('failure to read applications does not start deletion', async (t) => {
  const context = await setup(t);
  t.mock.method(Candidate, 'find', async () => { throw new Error('Database unavailable'); });
  const res = response();
  await deleteJob(context.request(), res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(context.events, []);
  assert.equal(context.job.isDeleting, false);
});

for (const stage of ['application', 'job']) {
  test(`${stage} delete returning zero records is not reported as success`, async (t) => {
    const context = await setup(t);
    if (stage === 'application') {
      t.mock.method(Candidate, 'deleteOne', async () => ({ deletedCount: 0 }));
    } else {
      t.mock.method(Job, 'findById', async () => ({
        ...context.document(), deleteOne: async () => ({ deletedCount: 0 })
      }));
    }
    const res = response();
    await deleteJob(context.request(), res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.deletionIncomplete, true);
    assert.equal(context.job.isDeleting, true);
  });
}

test('failed application persistence does not delete a CV referenced by a stored application', async (t) => {
  const context = await setup(t, 0);
  const cvPath = await context.file();
  t.mock.method(processor, 'extractText', async () => 'Java');
  t.mock.method(Candidate, 'create', async (data) => {
    context.applications.push({ _id: 'ambiguous', ...data });
    throw new Error('Connection lost after database write');
  });
  const res = response();
  await submitApplication({ body: { jobId: 'job-1', name: 'Candidate', email: 'candidate@example.com' }, file: { path: resolveCVPath(cvPath) } }, res);
  assert.equal(res.statusCode, 500);
  assert.match(res.body.message, /linked to a stored application/);
  await fs.access(resolveCVPath(cvPath));
});

test('unavailable reference check leaves rejected upload in place and reports cleanup failure', async (t) => {
  const context = await setup(t, 0);
  context.job.isDeleting = true;
  const cvPath = await context.file();
  t.mock.method(Candidate, 'exists', async () => { throw new Error('Database unavailable'); });
  const res = response();
  await submitApplication({ body: { jobId: 'job-1' }, file: { path: resolveCVPath(cvPath) } }, res);
  assert.equal(res.statusCode, 500);
  assert.match(res.body.message, /cleanup could not be completed/);
  await fs.access(resolveCVPath(cvPath));
});

test('redirected uploads directory is rejected before unlink', async (t) => {
  const context = await setup(t);
  t.mock.method(fs, 'realpath', async () => path.resolve(uploadsDirectory, '../elsewhere'));
  await assert.rejects(removeCV(context.applications[0].cvPath), /redirected uploads/);
  await fs.access(resolveCVPath(context.applications[0].cvPath));
});

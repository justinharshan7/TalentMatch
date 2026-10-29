const { test } = require('node:test');
const assert = require('node:assert/strict');
const Job = require('../models/Job');
const Company = require('../models/Company');
const { createJob, updateJob } = require('./jobController');

const validInput = () => ({
  title: '  Java Developer  ',
  description: '  Build applications.\nWork with a team.  ',
  requirements: { skills: ['Java', 'java', ' React '] }
});

// Exercise the controllers with mocked persistence, without connecting to MongoDB.
function setup(t) {
  const stored = {
    title: 'Original title',
    description: 'Original description',
    requirements: { skills: ['Original'] },
    company: 'company-1'
  };
  const document = structuredClone(stored);
  let saves = 0;
  let creates = 0;
  document.save = async () => {
    saves++;
    Object.assign(stored, structuredClone({
      title: document.title,
      description: document.description,
      requirements: document.requirements
    }));
    return document;
  };
  t.mock.method(Job, 'findById', async () => document);
  t.mock.method(Company, 'findById', async () => ({ _id: 'company-1' }));
  t.mock.method(Job, 'create', async (data) => {
    creates++;
    return data;
  });
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  return {
    stored, document, res,
    saves: () => saves,
    creates: () => creates,
    request: (body) => ({ body, params: { id: 'job-1' }, user: { companyId: 'company-1' } })
  };
}

for (const [operation, controller, successCode] of [
  ['create', createJob, 201],
  ['update', updateJob, 200]
]) {
  test(`${operation}: trims values, deduplicates every category, preserves first spelling`, async (t) => {
    const context = setup(t);
    const input = validInput();
    for (const category of ['education', 'experience', 'certifications', 'softSkills']) {
      input.requirements[category] = [' First ', 'first', 'SECOND', ' second '];
    }
    const originalInput = structuredClone(input);
    await controller(context.request(input), context.res);
    assert.equal(context.res.statusCode, successCode);
    assert.equal(context.res.body.title, 'Java Developer');
    assert.equal(context.res.body.description, 'Build applications.\nWork with a team.');
    assert.deepEqual(context.res.body.requirements.skills, ['Java', 'React']);
    for (const category of ['education', 'experience', 'certifications', 'softSkills']) {
      assert.deepEqual(context.res.body.requirements[category], ['First', 'SECOND']);
    }
    assert.deepEqual(input, originalInput, 'request body must not be mutated');
    assert.equal(context.creates() + context.saves(), 1);
  });

  test(`${operation}: accepts omitted and empty optional categories`, async (t) => {
    const context = setup(t);
    const input = validInput();
    input.requirements.education = [];
    await controller(context.request(input), context.res);
    assert.equal(context.res.statusCode, successCode);
    for (const category of ['education', 'experience', 'certifications', 'softSkills']) {
      assert.deepEqual(context.res.body.requirements[category], []);
    }
  });

  const invalidCases = [
    ['missing body', () => undefined, /title/i],
    ['missing title', (input) => { delete input.title; }, /title/i],
    ['numeric title', (input) => { input.title = 123; }, /title/i],
    ['short trimmed title', (input) => { input.title = ' ab '; }, /title/i],
    ['blank title', (input) => { input.title = '   '; }, /title/i],
    ['missing description', (input) => { delete input.description; }, /description/i],
    ['non-string description', (input) => { input.description = {}; }, /description/i],
    ['blank description', (input) => { input.description = '\n  '; }, /description/i],
    ['missing requirements', (input) => { delete input.requirements; }, /requirements/i],
    ...[null, [], 'Java', 42].map((value) => [
      `wrong requirements type ${JSON.stringify(value)}`,
      (input) => { input.requirements = value; }, /requirements/i
    ]),
    ['missing skills', (input) => { delete input.requirements.skills; }, /skill/i],
    ['empty skills', (input) => { input.requirements.skills = []; }, /skill/i]
  ];

  for (const category of ['skills', 'education', 'experience', 'certifications', 'softSkills']) {
    for (const value of ['Java', null, {}, 12]) {
      invalidCases.push([
        `${category} wrong array type ${JSON.stringify(value)}`,
        (input) => { input.requirements[category] = value; }, new RegExp(category)
      ]);
    }
    for (const value of ['   ', 12, null, {}, []]) {
      invalidCases.push([
        `${category} invalid keyword ${JSON.stringify(value)}`,
        (input) => { input.requirements[category] = ['Valid', value]; }, new RegExp(category)
      ]);
    }
  }

  for (const [label, changeInput, message] of invalidCases) {
    test(`${operation}: rejects ${label} without changing data`, async (t) => {
      const context = setup(t);
      let input = validInput();
      if (label === 'missing body') input = undefined;
      else changeInput(input);
      const before = structuredClone(context.stored);
      await controller(context.request(input), context.res);
      assert.equal(context.res.statusCode, 400);
      assert.match(context.res.body.message, message);
      assert.equal(context.creates(), 0);
      assert.equal(context.saves(), 0);
      assert.deepEqual(context.stored, before);
      const { save, ...documentData } = context.document;
      assert.deepEqual(documentData, before, 'validation must finish before any document assignment');
    });
  }
}

test('update: rejects another company before modifying or saving the job', async (t) => {
  const context = setup(t);
  const req = context.request(validInput());
  req.user.companyId = 'company-2';
  const before = structuredClone(context.stored);
  await updateJob(req, context.res);
  assert.equal(context.res.statusCode, 403);
  assert.equal(context.saves(), 0);
  const { save, ...documentData } = context.document;
  assert.deepEqual(documentData, before);
  assert.deepEqual(context.stored, before);
});

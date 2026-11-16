const path = require('node:path');
const fs = require('node:fs/promises');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Company = require('../models/Company');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const { scoreCV } = require('../utils/cvProcessor');

const serverRoot = path.resolve(__dirname, '..');
const demoPassword = 'HeroVerseDemo!2026';
const companyId = '71de00000000000000000001';
const people = [
  { _id: '71de00000000000000000011', name: 'Batman', email: 'batman@heroverse.test' },
  { _id: '71de00000000000000000012', name: 'Spider-Man', email: 'spiderman@heroverse.test' }
];
const jobs = [
  { _id: '71de00000000000000000021', title: 'Frontend Developer', description: 'Build accessible web interfaces for HeroVerse. This is a fictional QA demonstration vacancy.', requirements: { skills: ['React', 'JavaScript', 'HTML', 'CSS'], education: ['BSc'], experience: ['2 years'], certifications: ['AWS'], softSkills: ['teamwork'] } },
  { _id: '71de00000000000000000022', title: 'Backend Developer', description: 'Develop APIs and database services for HeroVerse. This is a fictional QA demonstration vacancy.', requirements: { skills: ['Node.js', 'Express', 'MongoDB'], education: ['BSc'], experience: ['3 years'], certifications: ['AWS'], softSkills: ['problem solving'] } },
  { _id: '71de00000000000000000023', title: 'QA Analyst', description: 'Design test cases and check web applications for HeroVerse. This is a fictional QA demonstration vacancy.', requirements: { skills: ['testing', 'Postman', 'Selenium', 'SQL'], education: ['BSc'], experience: ['1 year'], certifications: ['ISTQB'], softSkills: ['communication'] } }
];
const applicants = [
  { _id: '71de00000000000000000031', name: 'Iron Man', email: 'ironman@heroes.test', job: jobs[0]._id, summary: 'React JavaScript HTML CSS. BSc. 2 years. AWS. Teamwork.' },
  { _id: '71de00000000000000000032', name: 'Wonder Woman', email: 'wonderwoman@heroes.test', job: jobs[0]._id, summary: 'React HTML. BSc. Teamwork.' },
  { _id: '71de00000000000000000033', name: 'Thor', email: 'thor@heroes.test', job: jobs[1]._id, summary: 'Node.js Express MongoDB. BSc. 3 years. AWS. Problem solving.' },
  { _id: '71de00000000000000000034', name: 'Hulk', email: 'hulk@heroes.test', job: jobs[2]._id, summary: 'Testing SQL. Communication.' }
];

function requireLocalDemoDatabase(uri) {
  let url;
  try { url = new URL(uri); } catch { throw new Error('Configure a valid local MONGO_URI in server/.env first.'); }
  if (url.protocol !== 'mongodb:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.pathname !== '/talentmatch_qa' || url.searchParams.has('dbName')) {
    throw new Error('Demo data can only be added to the local talentmatch_qa database. No data was changed.');
  }
}

// A small, valid one-page PDF for fictional CV viewing/download demonstrations.
function makeDemoPDF(lines) {
  const escape = (text) => text.replace(/([\\()])/g, '\\$1');
  const stream = ['BT', '/F1 12 Tf', '50 780 Td', ...lines.flatMap((line, index) => [index ? '0 -22 Td' : '', `(${escape(line)}) Tj`]), 'ET'].filter(Boolean).join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

async function insertMissing(Model, data, ownerField) {
  const current = await Model.findById(data._id);
  if (current) {
    if (ownerField && String(current[ownerField]) !== String(data[ownerField])) {
      throw new Error('A demo ID is already associated with another company. Existing data was preserved.');
    }
    return { record: current, created: false };
  }
  return { record: await Model.create(data), created: true };
}

async function seedDemo() {
  require('dotenv').config({ path: path.join(serverRoot, '.env'), quiet: true });
  requireLocalDemoDatabase(process.env.MONGO_URI);
  const counts = { companies: 0, users: 0, jobs: 0, applications: 0 };
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'talentmatch_qa', serverSelectionTimeoutMS: 5000 });
    // Check unique-name/email collisions before adding any records.
    const existingCompany = await Company.findOne({ name: 'HeroVerse' });
    if (existingCompany && String(existingCompany._id) !== companyId) {
      throw new Error('HeroVerse already exists with a different ID. It was not changed; use another local QA database or inspect the existing company.');
    }
    for (const person of people) {
      const existing = await User.findOne({ email: person.email });
      if (existing && String(existing._id) !== person._id) throw new Error('A demo email is already in use by another account. Existing data was preserved.');
    }
    const company = await insertMissing(Company, { _id: companyId, name: 'HeroVerse', description: 'A fictional company combining Marvel and DC heroes for TalentMatch QA demonstrations.' });
    counts.companies += Number(company.created);
    for (const person of people) {
      const password = await bcrypt.hash(demoPassword, 10);
      const user = await insertMissing(User, { ...person, password, companyId }, 'companyId');
      counts.users += Number(user.created);
    }
    const storedJobs = new Map();
    for (const entry of jobs) {
      const job = await insertMissing(Job, { ...entry, company: companyId }, 'company');
      counts.jobs += Number(job.created);
      storedJobs.set(entry._id, job.record);
    }
    const uploads = path.join(serverRoot, 'uploads');
    await fs.mkdir(uploads, { recursive: true });
    if (await fs.realpath(uploads) !== uploads) throw new Error('Demo CV storage cannot use a redirected uploads directory.');
    for (const person of applicants) {
      const job = storedJobs.get(person.job);
      if (job.isDeleting) { console.log(`Skipped applications for ${job.title}: deletion is in progress.`); continue; }
      const filename = `qa-demo-${person._id}.pdf`;
      const cvPath = `uploads/${filename}`;
      const existing = await Candidate.findById(person._id);
      if (existing && (String(existing.company) !== companyId || String(existing.job) !== person.job)) {
        throw new Error('A demo application ID is in use elsewhere. Existing data was preserved.');
      }
      if (existing && existing.cvPath !== cvPath) continue;
      const lines = ['HeroVerse fictional demo CV', 'Sample data only - no real applicant information.', person.name, person.email, ...person.summary.split('. ').filter(Boolean)];
      try { await fs.writeFile(path.join(uploads, filename), makeDemoPDF(lines), { flag: 'wx' }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
      if (!existing) {
        const scores = scoreCV(lines.join('\n'), job.requirements);
        await Candidate.create({ _id: person._id, name: person.name, email: person.email, job: person.job, company: companyId, cvPath, scores, status: scores.total >= 700 ? 'shortlisted' : 'rejected' });
        counts.applications++;
      }
    }
    console.log('HeroVerse demo data is ready. Added:', JSON.stringify(counts));
    for (const person of people) {
      const saved = await User.findById(person._id);
      if (saved.email === person.email && await bcrypt.compare(demoPassword, saved.password)) {
        console.log(`${person.name}: ${person.email} / ${demoPassword}`);
      } else {
        console.log(`${person.name}: existing account details were preserved; use its current credentials.`);
      }
    }
    console.log('Existing records and passwords were not reset. Demo credentials are for local QA only.');
    return counts;
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) {
  seedDemo().catch((error) => {
    console.error(error.name === 'MongoServerSelectionError' ? 'Cannot reach local MongoDB. Start the MongoDB service, then run the command again.' : error.message);
    process.exitCode = 1;
  });
}
module.exports = { requireLocalDemoDatabase, makeDemoPDF, seedDemo };

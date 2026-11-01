const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const path = require('node:path');
const { withJobLock } = require('../utils/jobLifecycle');
const { removeCV, getCVPathForRead, cvPathKey } = require('../utils/cvStorage');
const { isObjectIdOrHexString } = require('mongoose');
const cvProcessor = require('../utils/cvProcessor');

// Submit application
const submitApplication = async (req, res) => {
  let applicationSaved = false;
  let response;
  try {
    const { name, email, jobId } = req.body;
    response = await withJobLock(jobId, async () => {
      const job = await Job.findById(jobId).populate('company');
      if (!job) {
        return { status: 404, body: { message: 'Job not found' } };
      }
      if (job.isDeleting) {
        return { status: 409, body: { message: 'This job is being permanently deleted and no longer accepts applications.' } };
      }

      const cvPath = req.file.path;
      const cvText = await cvProcessor.extractText(cvPath);
      const scores = cvProcessor.scoreCV(cvText, job.requirements);

      const status = scores.total >= 700 ? 'shortlisted' : 'rejected';

      await Candidate.create({
        name,
        email,
        cvPath: `uploads/${path.basename(cvPath)}`,
        job: jobId,
        company: job.company._id,
        scores,
        status
      });
      applicationSaved = true;

      return {
        status: 201,
        body: {
          message: 'Application submitted successfully',
          jobTitle: job.title,
          companyName: job.company.name
        }
      };
    });

  } catch (error) {
    response = { status: 500, body: { message: 'Server error', error: error.message } };
  }

  if (!applicationSaved && req.file) {
    try {
      // A failed database response can be ambiguous. Do not remove a CV if
      // an application was actually stored, or its existence cannot be checked.
      const cvPath = `uploads/${path.basename(req.file.path)}`;
      const referenced = await Candidate.exists({ cvPath });
      if (referenced) {
        throw new Error('The uploaded CV is linked to a stored application; refresh before applying again');
      }
      await removeCV(req.file.path);
    } catch (cleanupError) {
      response = { status: 500, body: {
        message: `${response.body.message}. Uploaded CV cleanup could not be completed: ${cleanupError.message}`
      } };
    }
  }
  return res.status(response.status).json(response.body);
};

function checkHRCompany(req, res) {
  if (!req.user) {
    res.status(401).json({ message: 'Please sign in to access candidates' });
    return false;
  }
  if (!req.user.companyId) {
    res.status(403).json({ message: 'Your HR account has no associated company' });
    return false;
  }
  return true;
}

async function getOwnedCandidate(req, res) {
  if (!checkHRCompany(req, res)) return null;
  if (!isObjectIdOrHexString(req.params.id)) {
    res.status(400).json({ message: 'Invalid candidate ID' });
    return null;
  }
  const candidate = await Candidate.findById(req.params.id);
  if (!candidate) {
    res.status(404).json({ message: 'Candidate not found' });
    return null;
  }
  if (candidate.company?.toString() !== req.user.companyId.toString()) {
    res.status(403).json({ message: 'This candidate belongs to another company' });
    return null;
  }
  return candidate;
}

// Check job ownership before querying any candidate information.
const getCandidates = async (req, res) => {
  try {
    if (!checkHRCompany(req, res)) return;
    if (!isObjectIdOrHexString(req.params.jobId)) {
      return res.status(400).json({ message: 'Invalid job ID' });
    }
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.company?.toString() !== req.user.companyId.toString()) {
      return res.status(403).json({ message: 'This job belongs to another company' });
    }
    const candidates = await Candidate.find({ job: job._id, company: req.user.companyId })
      .sort({ 'scores.total': -1 });

    res.status(200).json(candidates);

  } catch (error) {
    res.status(500).json({ message: 'Unable to load candidates' });
  }
};

// Get single candidate
const getCandidate = async (req, res) => {
  try {
    const candidate = await getOwnedCandidate(req, res);
    if (!candidate) return;
    await candidate.populate([{ path: 'job', select: 'title' }, { path: 'company', select: 'name' }]);

    res.status(200).json(candidate);

  } catch (error) {
    res.status(500).json({ message: 'Unable to load candidate details' });
  }
};

// The URL contains only a candidate ID; the file path comes from its record.
const getCandidateCV = async (req, res) => {
  try {
    const candidate = await getOwnedCandidate(req, res);
    if (!candidate) return;
    const cvPath = await getCVPathForRead(candidate.cvPath);
    res.set('Content-Disposition', `inline; filename="candidate-${candidate._id}${path.extname(cvPath).toLowerCase()}"`);
    return res.sendFile(cvPath, {
      lastModified: false,
      headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
    }, (error) => {
      if (!error) return;
      if (res.headersSent) return res.destroy();
      const missing = error.code === 'ENOENT' || error.statusCode === 404;
      res.status(missing ? 404 : 500).json({ message: missing ? 'CV file not found' : 'Unable to read CV file' });
    });
  } catch (error) {
    const missing = error.code === 'ENOENT';
    res.status(missing ? 404 : 500).json({ message: missing ? 'CV file not found' : 'Unable to read CV file safely' });
  }
};

const deleteCandidate = async (req, res) => {
  let cvCleanupCompleted = false;
  try {
    const initial = await getOwnedCandidate(req, res);
    if (!initial) return;
    if (!isObjectIdOrHexString(initial.job)) {
      return res.status(409).json({ message: 'Application has no valid job reference. Nothing was deleted.' });
    }
    return await withJobLock(initial.job, async () => {
      const candidate = await getOwnedCandidate(req, res);
      if (!candidate) return;
      if (candidate.job?.toString() !== initial.job.toString()) {
        return res.status(409).json({ message: 'Application changed. Refresh before deleting.' });
      }
      const job = await Job.findById(candidate.job);
      if (!job || job.company?.toString() !== req.user.companyId.toString()) {
        return res.status(409).json({ message: 'Application job ownership could not be verified. Nothing was deleted.' });
      }
      if (job.isDeleting) {
        return res.status(409).json({ message: 'Job deletion is incomplete or in progress. Use Retry Deletion on the job.' });
      }
      const key = cvPathKey(candidate.cvPath);
      const others = await Candidate.find({ _id: { $ne: candidate._id } }).select('cvPath');
      if (others.some((other) => cvPathKey(other.cvPath) === key)) {
        return res.status(409).json({ message: 'This CV is shared with another application. Nothing was deleted.' });
      }
      const removed = await removeCV(candidate.cvPath);
      cvCleanupCompleted = true;
      const result = await Candidate.deleteOne({
        _id: candidate._id, company: req.user.companyId, job: candidate.job, cvPath: candidate.cvPath
      });
      if (result.deletedCount !== 1) throw new Error('Application deletion was not confirmed');
      return res.status(200).json({
        message: removed ? 'Application and uploaded CV permanently deleted.' : 'Application permanently deleted. Its CV was already missing.'
      });
    });
  } catch {
    return res.status(500).json({
      cvCleanupCompleted,
      message: cvCleanupCompleted
        ? 'CV cleanup completed, but application deletion could not be confirmed. Refresh the list; retry if the application remains.'
        : 'Application deletion could not be completed. The application was not removed; CV cleanup may be incomplete. Refresh before retrying.'
    });
  }
};

module.exports = { submitApplication, getCandidates, getCandidate, getCandidateCV, deleteCandidate };

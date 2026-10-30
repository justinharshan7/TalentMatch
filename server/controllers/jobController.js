const Job = require('../models/Job');
const Company = require('../models/Company');
const Candidate = require('../models/Candidate');
const { withJobLock } = require('../utils/jobLifecycle');
const { cvPathKey, removeCV } = require('../utils/cvStorage');
const validateJobInput = (input) => {
  const { title, description, requirements } = input || {};
  if (typeof title !== 'string' || title.trim().length < 3) {
    return { error: 'Job title must be a string with at least 3 non-padding characters' };
  }
  if (typeof description !== 'string' || !description.trim()) {
    return { error: 'Description must be a nonblank string' };
  }
  if (!requirements || typeof requirements !== 'object' || Array.isArray(requirements)) {
    return { error: 'Requirements must be an object' };
  }

  const cleanedRequirements = {};
  for (const category of ['skills', 'education', 'experience', 'certifications', 'softSkills']) {
    const keywords = Object.hasOwn(requirements, category) ? requirements[category] : [];
    if (!Array.isArray(keywords)) {
      return { error: `${category} must be an array of strings` };
    }

    const seen = new Set();
    cleanedRequirements[category] = [];
    for (const keyword of keywords) {
      if (typeof keyword !== 'string' || !keyword.trim()) {
        return { error: `${category} keywords must be nonblank strings` };
      }
      const trimmed = keyword.trim();
      const normalized = trimmed.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        cleanedRequirements[category].push(trimmed);
      }
    }
  }

  if (cleanedRequirements.skills.length === 0) {
    return { error: 'Add at least one skill' };
  }
  return {
    data: { title: title.trim(), description: description.trim(), requirements: cleanedRequirements }
  };
};

// Create job
const createJob = async (req, res) => {
  try {
    const { error, data } = validateJobInput(req.body);
    if (error) {
      return res.status(400).json({ message: error });
    }
    const companyId = req.user.companyId;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const job = await Job.create({
      ...data,
      company: companyId
    });

    res.status(201).json(job);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all jobs
const getJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ isDeleting: { $ne: true } }).populate('company', 'name description');
    res.status(200).json(jobs);
    //in Job model, company only stores the company's ID - not the full company details.
    // .populate('company', 'name description') tells Mongoose "go fetch the actual company document",
    // "and replace the ID with its name and description".

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get jobs for logged-in HR's company only
const getMyJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ company: req.user.companyId }).populate('company', 'name description');
    res.status(200).json(jobs);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get single job
const getJob = async (req, res) => {
  try {     //const job = await Job.findById(req.params.id) - Finds a single job by its ID.
    const job = await Job.findById(req.params.id).populate('company', 'name description');
    if (!job || job.isDeleting) {
      return res.status(404).json({ message: 'Job not found' });
    }
    res.status(200).json(job);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Read-only: confirmation or cancellation never starts deletion.
const getDeletionInfo = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.company.toString() !== req.user.companyId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this job' });
    }
    const applicationCount = await Candidate.countDocuments({ job: job._id });
    res.status(200).json({ applicationCount, isDeleting: !!job.isDeleting });
  } catch (error) {
    res.status(500).json({ message: 'Unable to check applications. Nothing was deleted.' });
  }
};

// Cleanup is permanent and may partially complete. Keep the job until the end
// so its persisted flag and remaining application records allow a retry.
const deleteJob = async (req, res) => {
  let cleanupStarted = false;
  try {
    return await withJobLock(req.params.id, async () => {
      const job = await Job.findById(req.params.id);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      if (job.company.toString() !== req.user.companyId.toString()) {
        return res.status(403).json({ message: 'Not authorized to delete this job' });
      }

      const expectedCount = req.body?.expectedApplicationCount;
      if (!Number.isInteger(expectedCount) || expectedCount < 0) {
        return res.status(400).json({ message: 'Check the application count and confirm deletion first.' });
      }
      const applications = await Candidate.find({ job: job._id });
      if (applications.length !== expectedCount) {
        return res.status(409).json({ message: 'The application count changed. Check and confirm deletion again.' });
      }

      job.isDeleting = true;
      await job.save();
      cleanupStarted = true;

      // Resolve all paths and detect legacy shared files before deleting any file.
      const otherApplications = await Candidate.find({ job: { $ne: job._id } });
      const otherPaths = new Set(otherApplications.map((application) => cvPathKey(application.cvPath)));
      for (const application of applications) {
        if (application.company.toString() !== job.company.toString()) {
          throw new Error('An application has inconsistent company ownership');
        }
        if (otherPaths.has(cvPathKey(application.cvPath))) {
          throw new Error('A CV is referenced by another job; cleanup stopped to protect that file');
        }
      }

      let alreadyMissingFiles = 0;
      for (const application of applications) {
        if (!await removeCV(application.cvPath)) alreadyMissingFiles++;
        const result = await Candidate.deleteOne({ _id: application._id, job: job._id });
        if (result.deletedCount !== 1) throw new Error('An application could not be removed');
      }
      const result = await job.deleteOne();
      if (result.deletedCount !== 1) throw new Error('The job could not be removed');
      return res.status(200).json({
        message: 'Job, associated applications, and uploaded CVs permanently deleted.'
          + (alreadyMissingFiles ? ` ${alreadyMissingFiles} CV file(s) were already absent.` : '')
      });
    });

  } catch (error) {
    res.status(500).json({
      deletionIncomplete: cleanupStarted,
      message: cleanupStarted
        ? `Deletion incomplete. Some cleanup may already be permanent. The job remains closed; use Retry Deletion. ${error.message}`
        : 'Unable to start deletion. Refresh the job list and try again.'
    });
  }
};

// Update job (only if it belongs to the logged-in HR's company)
const updateJob = async (req, res) => {
  try {
    return await withJobLock(req.params.id, async () => {
      const job = await Job.findById(req.params.id);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      if (job.company.toString() !== req.user.companyId.toString()) {
        return res.status(403).json({ message: 'Not authorized to edit this job' });
      }
      if (job.isDeleting) {
        return res.status(409).json({ message: 'This job has incomplete deletion and cannot be edited.' });
      }

      const { error, data } = validateJobInput(req.body);
      if (error) {
        return res.status(400).json({ message: error });
      }
      job.title = data.title;
      job.description = data.description;
      job.requirements = data.requirements;

      const updated = await job.save();
      res.status(200).json(updated);
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { createJob, getJobs, getJob, getMyJobs, getDeletionInfo, deleteJob, updateJob };

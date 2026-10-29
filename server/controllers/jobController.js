const Job = require('../models/Job');
const Company = require('../models/Company');
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
    const jobs = await Job.find().populate('company', 'name description');
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
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    res.status(200).json(job);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete job (only if it belongs to the logged-in HR's company)
const deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.company.toString() !== req.user.companyId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this job' });
    }

    await job.deleteOne();
    res.status(200).json({ message: 'Job deleted' });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update job (only if it belongs to the logged-in HR's company)
const updateJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.company.toString() !== req.user.companyId.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this job' });
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

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { createJob, getJobs, getJob, getMyJobs, deleteJob, updateJob };

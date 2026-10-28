const Job = require('../models/Job');
const Company = require('../models/Company');
const validateJobInput = ({ title, description, requirements }) => {
  if (!title || !title.trim()) return 'Job title is required';
  if (title.trim().length < 3) return 'Job title must be at least 3 characters';
  if (!description || !description.trim()) return 'Description is required';
  if (!requirements?.skills || requirements.skills.length === 0) return 'Add at least one skill';
  return null;
};

// Create job
const createJob = async (req, res) => {
  try {
    const { title, description, requirements } = req.body;
        const validationError = validateJobInput({ title, description, requirements });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
    const companyId = req.user.companyId;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const job = await Job.create({
      title,
      description,
      requirements,
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

    const { title, description, requirements } = req.body;
    const validationError = validateJobInput({ title, description, requirements });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
    job.title = title ?? job.title;
    job.description = description ?? job.description;
    job.requirements = requirements ?? job.requirements;

    const updated = await job.save();
    res.status(200).json(updated);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { createJob, getJobs, getJob, getMyJobs, deleteJob, updateJob };
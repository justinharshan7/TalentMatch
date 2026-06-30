const Job = require('../models/Job');
const Company = require('../models/Company');

// Create job
const createJob = async (req, res) => {
  try {
    const { title, description, requirements, companyId } = req.body;

    const company = await Company.findById(companyId); //Checks if the company exists before creating a job.
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

module.exports = { createJob, getJobs, getJob };
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const upload = require('../utils/uploadConfig');
const { extractText, scoreCV } = require('../utils/cvProcessor');

// Submit application
const submitApplication = async (req, res) => {
  try {
    const { name, email, jobId } = req.body;

    const job = await Job.findById(jobId).populate('company');
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const cvPath = req.file.path;
    const cvText = await extractText(cvPath);
    const scores = scoreCV(cvText, job.requirements);

    const status = scores.total >= 700 ? 'shortlisted' : 'rejected';

    const candidate = await Candidate.create({
      name,
      email,
      cvPath,
      job: jobId,
      company: job.company._id,
      scores,
      status
    });

    res.status(201).json({
      message: 'Application submitted successfully',
      candidate: {
        id: candidate._id,
        name: candidate.name,
        email: candidate.email,
        scores: candidate.scores,
        status: candidate.status
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all candidates for a job
const getCandidates = async (req, res) => {
  try {
    const candidates = await Candidate.find({ job: req.params.jobId })
      .sort({ 'scores.total': -1 });

    res.status(200).json(candidates);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get single candidate
const getCandidate = async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id)
      .populate('job', 'title')
      .populate('company', 'name');

    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    res.status(200).json(candidate);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { submitApplication, getCandidates, getCandidate };
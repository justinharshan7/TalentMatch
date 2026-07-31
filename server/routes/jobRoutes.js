const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createJob, getJobs, getJob, getMyJobs, deleteJob } = require('../controllers/jobController');

router.post('/', protect, createJob);
router.get('/my-jobs', protect, getMyJobs);
router.get('/', getJobs);
router.get('/:id', getJob);
router.delete('/:id', protect, deleteJob);

module.exports = router;
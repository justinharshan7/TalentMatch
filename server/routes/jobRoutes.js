const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createJob, getJobs, getJob, getMyJobs, getDeletionInfo, deleteJob, updateJob } = require('../controllers/jobController');
router.post('/', protect, createJob);
router.get('/my-jobs', protect, getMyJobs);
router.get('/', getJobs);
router.get('/:id/deletion-info', protect, getDeletionInfo);
router.get('/:id', getJob);
router.delete('/:id', protect, deleteJob);
router.put('/:id', protect, updateJob);

module.exports = router;

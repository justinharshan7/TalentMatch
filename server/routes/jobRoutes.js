const express = require('express');
const router = express.Router();
const { createJob, getJobs, getJob } = require('../controllers/jobController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createJob);
router.get('/', getJobs);
router.get('/:id', getJob); //The :id is what we access with req.params.id in the controller.
//the :id is a URL parameter. It's a placeholder for any ID

module.exports = router;
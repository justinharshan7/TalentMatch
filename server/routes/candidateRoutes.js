const express = require('express');
const router = express.Router();
const { submitApplication, getCandidates, getCandidate, getCandidateCV, deleteCandidate } = require('../controllers/candidateController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../utils/uploadConfig');

router.post('/apply', upload.single('cv'), submitApplication); //upload.single('cv') - this is multer middleware.
router.get('/job/:jobId', protect, getCandidates); //protect - HR only, to see a single candidate details.
router.get('/:id/cv', protect, getCandidateCV);
router.get('/:id', protect, getCandidate);
router.delete('/:id', protect, deleteCandidate);

module.exports = router;

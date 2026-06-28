const express = require('express');
const router = express.Router();
const { createCompany, getCompanies } = require('../controllers/companyController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createCompany);
router.get('/', getCompanies);

module.exports = router;
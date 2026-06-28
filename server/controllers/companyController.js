const Company = require('../models/Company');

// Create company
const createCompany = async (req, res) => {
  try {
    const { name, description } = req.body;

    const existingCompany = await Company.findOne({ name });
    if (existingCompany) {
      return res.status(400).json({ message: 'Company already exists' });
    }

    const company = await Company.create({ name, description });

    res.status(201).json(company);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all companies
const getCompanies = async (req, res) => {
  try {
    const companies = await Company.find(); //The candidate page needs to show all available companies
    res.status(200).json(companies);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { createCompany, getCompanies };
const User = require('../models/User');
const Company = require('../models/Company');
const { Types } = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Public signup creates a new company; it never grants access to an existing one.
const register = async (req, res) => {
  let createdCompanyId;
  let userId;
  let token;
  let account;
  try {
    const body = req.body || {};
    if (Object.hasOwn(body, 'companyId')) {
      return res.status(400).json({ message: 'Registration creates a new company. Joining an existing company is not supported.' });
    }
    const { password } = body;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
    const companyDescription = typeof body.companyDescription === 'string' ? body.companyDescription.trim() : '';
    if (!name || name.length > 100 || !companyName || companyName.length > 100
      || !companyDescription || companyDescription.length > 2000) {
      return res.status(400).json({ message: 'Enter your name, company name and company description within the displayed limits.' });
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Password must contain at least 8 characters.' });
    }
    if (Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ message: 'Password is too long. Please use a shorter password.' });
    }

    const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingUser = await User.findOne({ email: new RegExp(`^${escapedEmail}$`, 'i') });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    const existingCompany = await Company.findOne({ name: companyName });
    if (existingCompany) {
      return res.status(400).json({ message: 'Company already exists. Sign in with your existing HR account.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    userId = new Types.ObjectId();
    const companyId = new Types.ObjectId();
    // Generate the token before persistence so configuration errors leave no records.
    token = jwt.sign(
      { id: userId, companyId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    const company = await Company.create({ _id: companyId, name: companyName, description: companyDescription });
    createdCompanyId = company._id;
    account = { id: userId, name, email, companyId, company };
    await User.create({ _id: userId, name, email, password: hashedPassword, companyId });
    return res.status(201).json({
      token,
      user: account
    });

  } catch (error) {
    if (createdCompanyId) {
      try {
        // A failed acknowledgement may still mean the user was stored.
        if (await User.exists({ _id: userId })) {
          return res.status(201).json({ token, user: account });
        }
        // Only remove the newly created company when it has no associated user.
        if (!await User.exists({ companyId: createdCompanyId })) {
          const cleanup = await Company.deleteOne({ _id: createdCompanyId });
          if (cleanup.deletedCount !== 1) throw new Error('Cleanup was not confirmed');
        }
      } catch {
        return res.status(500).json({ message: 'Registration could not be confirmed. Try signing in; if that fails, contact support before registering again.' });
      }
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email or company name is already registered.' });
    }
    return res.status(500).json({ message: 'Unable to create your account. Please try again.' });
  }
};

// Login HR
const login = async (req, res) => {
  try {
    const { password } = req.body || {};
    const originalEmail = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    if (!originalEmail || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    let user = await User.findOne({ email: originalEmail }).populate('companyId');
    if (!user && originalEmail !== originalEmail.toLowerCase()) {
      user = await User.findOne({ email: originalEmail.toLowerCase() }).populate('companyId');
    }
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, companyId: user.companyId._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, company: user.companyId }
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { register, login };

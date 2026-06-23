const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  requirements: {
    skills: {
      type: [String],
      default: []
    },
    education: {
      type: [String],
      default: []
    },
    experience: {
      type: [String],
      default: []
    },
    certifications: {
      type: [String],
      default: []
    },
    softSkills: {
      type: [String],
      default: []
    }
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Job', jobSchema);
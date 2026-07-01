const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const path = require('path');
const fs = require('fs');

// Extract text from CV file
const extractText = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } else if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } else {
    throw new Error('Unsupported file type');
  }
};

// Score CV against job requirements
const scoreCV = (cvText, requirements) => {
  const text = cvText.toLowerCase();

  const categoryWeights = {
    skills: 400,
    education: 200,
    experience: 200,
    certifications: 100,
    softSkills: 100
  };

  const scores = {
    skills: 0,
    education: 0,
    experience: 0,
    certifications: 0,
    softSkills: 0,
    total: 0
  };

  for (const category in categoryWeights) {
    const keywords = requirements[category] || [];
    if (keywords.length === 0) continue;

    const pointsPerKeyword = categoryWeights[category] / keywords.length;
    let matchCount = 0;

    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }

    scores[category] = Math.round(pointsPerKeyword * matchCount);
  }

  scores.total = scores.skills + scores.education + scores.experience + scores.certifications + scores.softSkills;

  return scores;
};

module.exports = { extractText, scoreCV };
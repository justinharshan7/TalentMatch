const fs = require('node:fs/promises');
const path = require('node:path');

const uploadsDirectory = path.resolve(__dirname, '../uploads');

function resolveCVPath(storedPath) {
  if (typeof storedPath !== 'string' || !storedPath || storedPath.includes('\0')) {
    throw new Error('Invalid CV path; no file was deleted');
  }
  const normalized = storedPath.replace(/\\/g, '/');
  if (normalized.split('/').includes('..')) {
    throw new Error('Unsafe CV path; no file was deleted');
  }
  const resolved = path.isAbsolute(normalized)
    ? path.resolve(normalized)
    : path.resolve(uploadsDirectory, '..', normalized);
  // Multer stores files directly in uploads. Reject nested paths as well.
  const relative = path.relative(uploadsDirectory, resolved);
  if (!relative || path.isAbsolute(relative) || relative.includes('/') || relative.includes('\\') || relative === '..') {
    throw new Error('CV path must point to a file inside uploads');
  }
  return resolved;
}

function cvPathKey(storedPath) {
  const resolved = resolveCVPath(storedPath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

async function removeCV(storedPath) {
  const resolved = resolveCVPath(storedPath);
  try {
    const stat = await fs.lstat(resolved);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error('CV cleanup refused a non-regular file');
    }
    // Refuse an uploads directory that redirects outside its expected location.
    const realDirectory = await fs.realpath(uploadsDirectory);
    if (path.relative(uploadsDirectory, realDirectory) !== '') {
      throw new Error('CV cleanup refused a redirected uploads directory');
    }
    await fs.unlink(resolved);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function getCVPathForRead(storedPath) {
  const resolved = resolveCVPath(storedPath);
  const stat = await fs.lstat(resolved);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error('CV access refused a non-regular file');
  }
  const realDirectory = await fs.realpath(uploadsDirectory);
  if (path.relative(uploadsDirectory, realDirectory) !== '') {
    throw new Error('CV access refused a redirected uploads directory');
  }
  if (!['.pdf', '.docx'].includes(path.extname(resolved).toLowerCase())) {
    throw new Error('Unsupported stored CV type');
  }
  return resolved;
}

module.exports = { uploadsDirectory, resolveCVPath, cvPathKey, removeCV, getCVPathForRead };

// This queue coordinates operations in this single Node.js server process.
const queues = new Map();

async function withJobLock(jobId, operation) {
  const key = String(jobId).toLowerCase();
  const previous = queues.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  queues.set(key, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (queues.get(key) === current) queues.delete(key);
  }
}

module.exports = { withJobLock };

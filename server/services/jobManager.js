const { EventEmitter } = require('events');
const { randomUUID } = require('crypto');

const jobs = new Map();
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

function createJob() {
  const id = randomUUID();
  const job = {
    id,
    status: 'queued',
    progress: 0,
    message: 'En cola...',
    filePath: null,
    fileName: null,
    error: null,
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

function getJob(id) {
  return jobs.get(id);
}

function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, patch);
  emitter.emit(`update:${id}`, { ...job });
}

function subscribe(id, callback) {
  emitter.on(`update:${id}`, callback);
  return () => emitter.removeListener(`update:${id}`, callback);
}

function removeJob(id) {
  jobs.delete(id);
}

function sweepOldJobs(ttlMs) {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > ttlMs) {
      jobs.delete(id);
    }
  }
}

module.exports = { createJob, getJob, updateJob, subscribe, removeJob, sweepOldJobs };

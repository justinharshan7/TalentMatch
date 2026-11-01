import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api'
});

// Add token to every request automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const loginHR = (data) => API.post('/auth/login', data);
export const registerHR = (data) => API.post('/auth/register', data);

// Companies
export const getCompanies = () => API.get('/companies');

// Jobs
export const getJobs = () => API.get('/jobs');
export const getJob = (id) => API.get(`/jobs/${id}`);
export const createJob = (data) => API.post('/jobs', data);
export const getMyJobs = () => API.get('/jobs/my-jobs');
export const getJobDeletionInfo = (id) => API.get(`/jobs/${id}/deletion-info`);
export const deleteJob = (id, expectedApplicationCount) => API.delete(`/jobs/${id}`, {
  data: { expectedApplicationCount }
});
export const updateJob = (id, data) => API.put(`/jobs/${id}`, data);

// Candidates
export const applyJob = (data) => API.post('/candidates/apply', data);
export const getCandidates = (jobId) => API.get(`/candidates/job/${jobId}`);
export const getCandidate = (id) => API.get(`/candidates/${id}`);
export const getCandidateCV = (id) => API.get(`/candidates/${id}/cv`, { responseType: 'blob' });
export const deleteCandidate = (id) => API.delete(`/candidates/${id}`);

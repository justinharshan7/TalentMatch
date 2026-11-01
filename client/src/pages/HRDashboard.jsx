import { useEffect, useState, useRef } from 'react';
import { getMyJobs, getCandidates, getCandidateCV, deleteCandidate } from '../services/api';
import Navbar from '../components/Navbar';

export default function HRDashboard() {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [openingCV, setOpeningCV] = useState(null);
  const [cvError, setCVError] = useState('');
  const cvBusy = useRef(false);
  const cvURLs = useRef(new Map());
  const [deletingId, setDeletingId] = useState(null);
  const deletionBusy = useRef(false);
  const [deletionFeedback, setDeletionFeedback] = useState(null);
  const candidateRequest = useRef(0);
  const currentJob = useRef(selectedJob);
  currentJob.current = selectedJob;

  const handleDelete = async (event, candidate) => {
    event.stopPropagation();
    if (deletionBusy.current || cvBusy.current) return;
    deletionBusy.current = true;
    const jobId = selectedJob;
    try {
      if (!window.confirm(`${candidate.name}\n\nDelete this application and its uploaded CV permanently? This cannot be undone.`)) return;
      setDeletingId(candidate._id);
      setDeletionFeedback(null);
      try {
        const { data } = await deleteCandidate(candidate._id);
        if (currentJob.current !== jobId) return;
        setCandidates((items) => items.filter((item) => item._id !== candidate._id));
        setExpandedId((id) => id === candidate._id ? null : id);
        setDeletionFeedback({ error: false, message: data.message });
      } catch (error) {
        if (currentJob.current !== jobId) return;
        setDeletionFeedback({ error: true, message: error.response?.data?.message
          || 'Application deletion could not be confirmed. Refresh to check its current status.' });
      }
      const request = ++candidateRequest.current;
      try {
        const { data } = await getCandidates(jobId);
        if (currentJob.current === jobId && request === candidateRequest.current) setCandidates(data);
      } catch {
        if (currentJob.current === jobId && request === candidateRequest.current) {
          setDeletionFeedback((feedback) => ({ error: true,
            message: `${feedback?.message || ''} Unable to refresh the applicant list. Reload this page.` }));
        }
      }
    } finally {
      deletionBusy.current = false;
      setDeletingId(null);
    }
  };

  useEffect(() => {
    const urls = cvURLs.current;
    return () => {
      for (const [url, timer] of urls) {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
      urls.clear();
    };
  }, []);

  const handleViewCV = async (event, candidateId) => {
    event.stopPropagation();
    if (cvBusy.current) return;
    if (deletionBusy.current) return;
    cvBusy.current = true;
    setOpeningCV(candidateId);
    setCVError('');
    let preview;
    try {
      // Open synchronously so the browser can associate the tab with this click.
      preview = window.open('about:blank', '_blank');
      if (preview) preview.opener = null;
      const response = await getCandidateCV(candidateId);
      const type = response.headers['content-type']?.split(';')[0].toLowerCase();
      const isPDF = type === 'application/pdf';
      if (!isPDF && type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        throw new Error('Unexpected CV file type');
      }
      const url = URL.createObjectURL(new Blob([response.data], { type }));
      const timer = setTimeout(() => {
        URL.revokeObjectURL(url);
        cvURLs.current.delete(url);
      }, 60000);
      cvURLs.current.set(url, timer);
      if (isPDF && preview && !preview.closed) {
        preview.location.href = url;
      } else {
        if (preview) preview.close();
        // DOCX needs an external reader. A blocked PDF popup also falls back to download.
        const link = document.createElement('a');
        link.href = url;
        link.download = `candidate-${candidateId}.${isPDF ? 'pdf' : 'docx'}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (error) {
      if (preview) preview.close();
      let message = 'Unable to open this CV. Please try again.';
      if (error.response?.status === 401) message = 'Your session has expired. Please sign in again.';
      else if (error.response?.status === 403) message = 'You do not have permission to view this CV.';
      else if (error.response?.status === 404) message = 'The candidate or CV file was not found.';
      else if (error.response?.data instanceof Blob) {
        try {
          const data = JSON.parse(await error.response.data.text());
          if (typeof data.message === 'string') message = data.message;
        } catch { /* Keep the readable fallback when the response is not JSON. */ }
      }
      setCVError(message);
    } finally {
      cvBusy.current = false;
      setOpeningCV(null);
    }
  };

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      window.location.href = '/hr-login';
      return;
    }
    getMyJobs().then((res) => {
      setJobs(res.data);
      if (res.data.length > 0) setSelectedJob(res.data[0]._id);
    });
  }, []);

  useEffect(() => {
    if (!selectedJob) return;
    let active = true;
    const request = ++candidateRequest.current;
    setDeletionFeedback(null);
    setLoading(true);
    getCandidates(selectedJob)
      .then((res) => { if (active && request === candidateRequest.current) setCandidates(res.data); })
      .catch((err) => console.error(err))
      .finally(() => { if (active && request === candidateRequest.current) setLoading(false); });
    return () => { active = false; };
  }, [selectedJob]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <Navbar />

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#14181F]">Candidates</h1>
            <p className="text-sm text-[#5B6472] mt-1">
              {candidates.length} applicant{candidates.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-3">
            <a href="/manage-jobs"
              className="bg-[#E5E8EE] text-[#5B6472] text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#D8DCE3] transition-colors"
            >
              Manage Jobs
            </a>
            <a href="/create-job"
              className="bg-[#2952E3] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#1F3FB8] transition-colors"
            >
              + Create Job
            </a>
          </div>
        </div>

        <div className="mb-6 relative w-72" ref={dropdownRef}>
          <label className="text-sm font-medium text-[#14181F] block mb-1">Select Job</label>
          <button
            type="button"
            disabled={deletingId !== null}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between border border-[#E5E8EE] rounded-lg px-4 py-2 text-sm bg-white text-left"
          >
            <span>
              {jobs.find((j) => j._id === selectedJob)
                ? `${jobs.find((j) => j._id === selectedJob).title} - ${jobs.find((j) => j._id === selectedJob).company?.name}`
                : 'Select a job'}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B6472" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute mt-1 w-full bg-white border border-[#E5E8EE] rounded-lg shadow-lg z-10 overflow-hidden">
              {jobs.map((job) => (
                <button
                  key={job._id}
                  type="button"
                  disabled={deletingId !== null}
                  onClick={() => {
                    setSelectedJob(job._id);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-[#F7F8FA] ${
                    selectedJob === job._id ? 'bg-[#F7F8FA] font-medium text-[#2952E3]' : 'text-[#14181F]'
                  }`}
                >
                  {job.title} - {job.company?.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {cvError && <p role="alert" className="text-sm text-red-600 mb-4">{cvError}</p>}
        {deletionFeedback && <p role={deletionFeedback.error ? 'alert' : 'status'} className={`text-sm mb-4 ${deletionFeedback.error ? 'text-red-600' : 'text-green-700'}`}>{deletionFeedback.message}</p>}
        <div className="bg-white border border-[#E5E8EE] rounded-xl overflow-hidden">
          {loading && (
            <div className="px-5 py-16 text-center text-[#5B6472] text-sm">Loading candidates...</div>
          )}

          {!loading && candidates.length === 0 && (
            <div className="px-5 py-16 text-center">
              <p className="text-[#5B6472] text-sm">No candidates have applied to this job yet.</p>
            </div>
          )}

          {!loading && candidates.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-[#F7F8FA] text-[#5B6472] text-left">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">CV</th>
                <th className="px-5 py-3 w-40">Match Score</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {candidates
                .slice()
                .sort((a, b) => b.scores.total - a.scores.total)
                .map((c) => (
                  <>
                    <tr
                      key={c._id}
                      onClick={() => setExpandedId(expandedId === c._id ? null : c._id)}
                      className="border-t border-[#E5E8EE] cursor-pointer hover:bg-[#F7F8FA]"
                    >
                      <td className="px-5 py-4 font-medium text-[#14181F]">{c.name}</td>
                      <td className="px-5 py-4 text-[#5B6472]">{c.email}</td>
                      <td className="px-5 py-4">
                        
                        <button
                          type="button"
                          disabled={openingCV !== null || deletingId !== null}
                          className="text-[#2952E3] text-xs font-medium hover:underline disabled:opacity-50"
                          onClick={(event) => handleViewCV(event, c._id)}
                        >
                          {openingCV === c._id ? 'Opening...' : 'View CV'}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-[#F7F8FA] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                c.scores.total >= 700 ? 'bg-[#1F9D6B]' : 'bg-[#C1666B]'
                              }`}
                              style={{ width: `${(c.scores.total / 1000) * 100}%` }}
                            />
                          </div>
                          <span className="font-bold text-[#14181F] text-xs w-10 text-right">
                            {c.scores.total}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          c.status === 'shortlisted'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button type="button" disabled={deletingId !== null || openingCV !== null}
                          onClick={(event) => handleDelete(event, c)}
                          className="text-red-600 text-xs font-medium hover:underline disabled:opacity-50">
                          {deletingId === c._id ? 'Deleting...' : 'Delete Application'}
                        </button>
                      </td>
                    </tr>
                    {expandedId === c._id && (
                      <tr className="bg-[#F7F8FA] border-t border-[#E5E8EE]">
                        <td colSpan="6" className="px-5 py-4">
                          <div className="grid grid-cols-5 gap-4 text-xs">
                            <div>
                              <p className="text-[#5B6472] mb-1">Skills</p>
                              <p className="font-bold text-[#14181F]">{c.scores.skills} / 400</p>
                            </div>
                            <div>
                              <p className="text-[#5B6472] mb-1">Education</p>
                              <p className="font-bold text-[#14181F]">{c.scores.education} / 200</p>
                            </div>
                            <div>
                              <p className="text-[#5B6472] mb-1">Experience</p>
                              <p className="font-bold text-[#14181F]">{c.scores.experience} / 200</p>
                            </div>
                            <div>
                              <p className="text-[#5B6472] mb-1">Certifications</p>
                              <p className="font-bold text-[#14181F]">{c.scores.certifications} / 100</p>
                            </div>
                            <div>
                              <p className="text-[#5B6472] mb-1">Soft Skills</p>
                              <p className="font-bold text-[#14181F]">{c.scores.softSkills} / 100</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
            </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

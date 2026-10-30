import { useState, useEffect, useRef } from 'react';
import { getMyJobs, getJobDeletionInfo, deleteJob } from '../services/api';
import Navbar from '../components/Navbar';
import BackLink from '../components/BackLink';

function requestProblem(error, checkingCount) {
  if (typeof error.response?.data?.message === 'string') return error.response.data.message;
  if (error.response) return `The server returned HTTP ${error.response.status}. Please refresh and try again.`;
  return checkingCount
    ? 'Cannot reach the server. No deletion request was sent.'
    : 'No response was received from the server. Refresh to check the current job status.';
}

export default function ManageJobs() {
  const [myJobs, setMyJobs] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [jobErrors, setJobErrors] = useState({});
  const [phase, setPhase] = useState('checking');
  const deletionBusy = useRef(false);

  const loadJobs = () => {
    return getMyJobs().then((res) => {
      setMyJobs(res.data);
      return res.data;
    });
  };

  useEffect(() => {
    loadJobs().catch(() => setFeedback({ error: true, message: 'Unable to load jobs. Please refresh and try again.' }));
  }, []);

  const handleDelete = async (job) => {
    const id = job._id;
    if (deletionBusy.current) return;
    deletionBusy.current = true;
    setBusyId(id);
    setPhase('checking');
    setFeedback(null);
    setJobErrors((current) => ({ ...current, [id]: null }));
    try {
      let data;
      try {
        ({ data } = await getJobDeletionInfo(id));
      } catch (error) {
        setJobErrors((current) => ({ ...current, [id]: `Could not check applications for "${job.title}": ${requestProblem(error, true)}` }));
        return;
      }
      if (!Number.isInteger(data?.applicationCount) || data.applicationCount < 0) {
        setJobErrors((current) => ({ ...current, [id]: `Could not check applications for "${job.title}": The server returned an invalid application count. No deletion request was sent.` }));
        return;
      }
      const warning = `Permanently delete "${job.title}"?\n\nApplications: ${data.applicationCount}\n\nThis will permanently remove the job, all associated applications, and their uploaded CVs. This cannot be undone. If deletion fails, some items may already have been permanently removed.\n\nContinue?`;
      if (!window.confirm(warning)) return;
      setPhase('deleting');
      try {
        await deleteJob(id, data.applicationCount);
        setMyJobs((jobs) => jobs.filter((item) => item._id !== id));
        setFeedback({ error: false, message: `"${job.title}" deleted.` });
      } catch (error) {
        const message = `Could not delete "${job.title}": ${requestProblem(error, false)}`;
        setJobErrors((current) => ({ ...current, [id]: message }));
        // Only show incomplete-deletion status when the backend provides evidence.
        if (error.response?.data?.deletionIncomplete === true) {
          setMyJobs((jobs) => jobs.map((item) => item._id === id ? { ...item, isDeleting: true } : item));
        }
        try {
          const jobs = await loadJobs();
          // If a lost response is followed by a missing row, keep the error visible.
          if (!jobs.some((item) => item._id === id)) setFeedback({ error: true, message });
        } catch {
          setJobErrors((current) => ({ ...current, [id]: `${current[id]} Unable to refresh the job status; reload this page.` }));
        }
      }
    } finally {
      deletionBusy.current = false;
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col">
      <Navbar />
      <div className="flex-1 px-6 py-10">
        <div className="max-w-2xl mx-auto">
          <BackLink to="/hr-dashboard" label="Back to Dashboard" />

          <div className="bg-white border border-[#E5E8EE] rounded-xl p-8 mt-4">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-[#14181F]">Manage Jobs</h1>
              <a href="/create-job" className="text-sm text-[#2952E3] font-medium">+ New Job</a>
            </div>

            {feedback && (
              <p role={feedback.error ? 'alert' : 'status'} className={`text-sm mb-4 ${feedback.error ? 'text-red-600' : 'text-green-700'}`}>
                {feedback.message}
              </p>
            )}
            {myJobs.length === 0 && (
              <p className="text-sm text-[#5B6472]">No jobs created yet.</p>
            )}
            <div className="space-y-3">
              {myJobs.map((job) => (
                <div key={job._id} className="flex flex-wrap gap-3 items-center justify-between border border-[#E5E8EE] rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#14181F]">{job.title}</p>
                    <p className="text-xs text-[#5B6472]">{job.company?.name}</p>
                    {job.isDeleting && (
                      <p className="text-xs text-red-600 mt-1">Deletion incomplete or in progress. Closed to applications and editing. Use Retry Deletion to finish cleanup.</p>
                    )}
                    {jobErrors[job._id] && <p role="alert" className="text-sm text-red-600 mt-2">{jobErrors[job._id]}</p>}
                  </div>
                  <div className="flex items-center gap-4">
                    {!job.isDeleting && <a href={`/edit-job/${job._id}`} className="text-sm text-[#2952E3] hover:underline font-medium">
                      Edit
                    </a>}
                    <button
                      onClick={() => handleDelete(job)}
                      disabled={busyId !== null}
                      className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busyId === job._id ? (phase === 'checking' ? 'Checking...' : 'Deleting...') : job.isDeleting ? 'Retry Deletion' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

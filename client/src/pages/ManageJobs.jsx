import { useState, useEffect } from 'react';
import { getMyJobs, deleteJob } from '../services/api';
import Navbar from '../components/Navbar';
import BackLink from '../components/BackLink';

export default function ManageJobs() {
  const [myJobs, setMyJobs] = useState([]);

  const loadJobs = () => {
    getMyJobs().then((res) => setMyJobs(res.data)).catch((err) => console.error(err));
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this job? This cannot be undone.')) return;
    try {
      await deleteJob(id);
      loadJobs();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete job');
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

            {myJobs.length === 0 && (
              <p className="text-sm text-[#5B6472]">No jobs created yet.</p>
            )}
            <div className="space-y-3">
              {myJobs.map((job) => (
                <div key={job._id} className="flex items-center justify-between border border-[#E5E8EE] rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#14181F]">{job.title}</p>
                    <p className="text-xs text-[#5B6472]">{job.company?.name}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(job._id)}
                    className="text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
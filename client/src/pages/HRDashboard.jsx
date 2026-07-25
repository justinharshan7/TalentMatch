import { useEffect, useState } from 'react';
import { getJobs, getCandidates } from '../services/api';
import Navbar from '../components/Navbar';

export default function HRDashboard() {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      window.location.href = '/hr-login';
      return;
    }
    getJobs().then((res) => {
      setJobs(res.data);
      if (res.data.length > 0) setSelectedJob(res.data[0]._id);
    });
  }, []);

  useEffect(() => {
    if (!selectedJob) return;
    setLoading(true);
    getCandidates(selectedJob)
      .then((res) => setCandidates(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedJob]);

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <Navbar />

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#14181F]">Candidates</h1>
          <button
            onClick={() => alert('Coming in a future update!')}
            className="bg-[#E5E8EE] text-[#5B6472] text-sm font-medium px-4 py-2 rounded-lg"
          >
            + Create Job
          </button>
        </div>

        <div className="mb-6">
          <label className="text-sm font-medium text-[#14181F] block mb-1">Select Job</label>
          <select
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            className="border border-[#E5E8EE] rounded-lg px-4 py-2 text-sm bg-white"
          >
            {jobs.map((job) => (
              <option key={job._id} value={job._id}>
                {job.title} — {job.company?.name}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white border border-[#E5E8EE] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#F7F8FA] text-[#5B6472] text-left">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Skills</th>
                <th className="px-5 py-3">Education</th>
                <th className="px-5 py-3">Experience</th>
                <th className="px-5 py-3">Certs</th>
                <th className="px-5 py-3">Soft Skills</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan="9" className="px-5 py-6 text-center text-[#5B6472]">Loading...</td></tr>
              )}
              {!loading && candidates.length === 0 && (
                <tr><td colSpan="9" className="px-5 py-6 text-center text-[#5B6472]">No candidates yet</td></tr>
              )}
              {candidates.map((c) => (
                <tr key={c._id} className="border-t border-[#E5E8EE]">
                  <td className="px-5 py-3 font-medium text-[#14181F]">{c.name}</td>
                  <td className="px-5 py-3 text-[#5B6472]">{c.email}</td>
                  <td className="px-5 py-3">{c.scores.skills}</td>
                  <td className="px-5 py-3">{c.scores.education}</td>
                  <td className="px-5 py-3">{c.scores.experience}</td>
                  <td className="px-5 py-3">{c.scores.certifications}</td>
                  <td className="px-5 py-3">{c.scores.softSkills}</td>
                  <td className="px-5 py-3 font-bold text-[#14181F]">{c.scores.total}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      c.status === 'shortlisted'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
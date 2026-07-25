import { useEffect, useState } from 'react';
import { getJobs, getCandidates } from '../services/api';
import Navbar from '../components/Navbar';

export default function HRDashboard() {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

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
          <div>
            <h1 className="text-2xl font-bold text-[#14181F]">Candidates</h1>
            <p className="text-sm text-[#5B6472] mt-1">
              {candidates.length} applicant{candidates.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => alert('Coming in a future update!')}
            className="bg-[#E5E8EE] text-[#5B6472] text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#D8DCE3] transition-colors"
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
                  <th className="px-5 py-3 w-40">Match Score</th>
                  <th className="px-5 py-3">Status</th>
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
                      </tr>
                      {expandedId === c._id && (
                        <tr className="bg-[#F7F8FA] border-t border-[#E5E8EE]">
                          <td colSpan="4" className="px-5 py-4">
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
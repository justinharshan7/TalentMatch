import { useState } from 'react';
import { createJob } from '../services/api';
import Navbar from '../components/Navbar';
import TagInput from '../components/TagInput';
import BackLink from '../components/BackLink';

export default function CreateJob() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState([]);
  const [education, setEducation] = useState([]);
  const [experience, setExperience] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [softSkills, setSoftSkills] = useState([]);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('submitting');
    setError('');

    try {
      await createJob({
        title,
        description,
        requirements: { skills, education, experience, certifications, softSkills },
      });
      setStatus('success');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create job');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="bg-white border border-[#E5E8EE] rounded-xl p-8 max-w-md text-center">
            <h2 className="text-xl font-bold text-[#14181F] mb-2">Job Created!</h2>
            <p className="text-[#5B6472] mb-6">Your job posting is now live.</p>
            <a href="/hr-dashboard" className="inline-block bg-[#2952E3] text-white text-sm font-medium px-4 py-2 rounded-lg">
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col">
      <Navbar />
      <div className="flex-1 px-6 py-10">
        <div className="max-w-2xl mx-auto bg-white border border-[#E5E8EE] rounded-xl p-8">
          <BackLink to="/hr-dashboard" label="Back to Dashboard" />

          <h1 className="text-2xl font-bold text-[#14181F] mt-4 mb-6">Create New Job</h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-[#14181F] block mb-1">Job Title</label>
              <input
                type="text" required value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-[#E5E8EE] rounded-lg px-4 py-2 text-sm outline-none focus:border-[#2952E3]"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[#14181F] block mb-1">Description</label>
              <textarea
                required value={description} rows={3}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-[#E5E8EE] rounded-lg px-4 py-2 text-sm outline-none focus:border-[#2952E3]"
              />
            </div>

            <TagInput label="Skills" tags={skills} setTags={setSkills} />
            <TagInput label="Education" tags={education} setTags={setEducation} />
            <TagInput label="Experience" tags={experience} setTags={setExperience} />
            <TagInput label="Certifications" tags={certifications} setTags={setCertifications} />
            <TagInput label="Soft Skills" tags={softSkills} setTags={setSoftSkills} />

            {status === 'error' && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit" disabled={status === 'submitting'}
              className="w-full bg-[#2952E3] text-white font-medium py-2.5 rounded-lg disabled:opacity-50 hover:bg-[#1F3FB8] transition-colors"
            >
              {status === 'submitting' ? 'Creating...' : 'Create Job'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
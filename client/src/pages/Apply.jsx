import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getJob, applyJob } from '../services/api';
import Navbar from '../components/Navbar';
import BackLink from '../components/BackLink';

export default function Apply() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cv, setCv] = useState(null);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    getJob(jobId).then((res) => setJob(res.data)).catch((err) => console.error(err));
  }, [jobId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('submitting');

    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('jobId', jobId);
    formData.append('cv', cv);

    try {
      const res = await applyJob(formData);
      setResult(res.data);
      setStatus('success');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="bg-white border border-[#E5E8EE] rounded-xl p-8 max-w-md text-center">
            <h2 className="text-xl font-bold text-[#14181F] mb-2">Application Submitted!</h2>
            <p className="text-[#5B6472] mb-4">
              Thanks, {result?.candidate?.name}. Your CV has been scored.
            </p>
            <p className="text-3xl font-bold text-[#2952E3] mb-1">
              {result?.candidate?.scores?.total} / 1000
            </p>
            <p className="text-sm text-[#5B6472]">
              Status: <span className="font-medium">{result?.candidate?.status}</span>
            </p>
            < a href="/" className="inline-block mt-6 text-sm text-[#2952E3] font-medium">
              Back to Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col">
      <Navbar />
      <div className="flex-1 px-6 py-12">
        <div className="max-w-lg mx-auto bg-white border border-[#E5E8EE] rounded-xl p-8">
          <BackLink to="/" label="Back" />

          <h1 className="text-2xl font-bold text-[#14181F] mt-4 mb-1">
            Apply {job ? `for ${job.title}` : ''}
          </h1>
          <p className="text-sm text-[#5B6472] mb-6">{job?.company?.name}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#14181F] block mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-[#E5E8EE] rounded-lg px-4 py-2 text-sm outline-none focus:border-[#2952E3] transition-colors"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[#14181F] block mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-[#E5E8EE] rounded-lg px-4 py-2 text-sm outline-none focus:border-[#2952E3] transition-colors"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[#14181F] block mb-1">Upload CV</label>
              <input
                type="file"
                required
                accept=".pdf,.docx"
                onChange={(e) => setCv(e.target.files[0])}
                className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#F7F8FA] file:text-[#5B6472] file:font-medium hover:file:bg-[#E5E8EE] file:cursor-pointer"
              />
            </div>

            {status === 'error' && (
              <p className="text-sm text-red-600">Something went wrong. Please try again.</p>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full bg-[#2952E3] text-white font-medium py-2.5 rounded-lg disabled:opacity-50 hover:bg-[#1F3FB8] transition-colors"
            >
              {status === 'submitting' ? 'Submitting...' : 'Submit Application'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
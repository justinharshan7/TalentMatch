import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getJob } from '../services/api';
import Navbar from '../components/Navbar';
import BackLink from '../components/BackLink';

const requirementCategories = [
  ['skills', 'Skills'],
  ['education', 'Education'],
  ['experience', 'Experience'],
  ['certifications', 'Certifications'],
  ['softSkills', 'Soft Skills'],
];

export default function JobDetails() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setJob(null);
    setError('');

    getJob(id)
      .then((res) => {
        if (!ignore) setJob(res.data);
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.response?.status === 404
            ? 'Job not found.'
            : 'Unable to load this job. Please try again later.');
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => { ignore = true; };
  }, [id]);

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col">
      <Navbar />
      <main className="flex-1 px-6 py-10">
        <div className="max-w-2xl mx-auto bg-white border border-[#E5E8EE] rounded-xl p-8 break-words">
          <BackLink to="/" label="Back to Jobs" />

          {loading && <p role="status" className="mt-6 text-sm text-[#5B6472]">Loading job details...</p>}
          {!loading && error && <p role="alert" className="mt-6 text-sm text-red-600">{error}</p>}
          {!loading && !error && !job && <p className="mt-6 text-sm text-[#5B6472]">Job not found.</p>}

          {!loading && !error && job && (
            <>
              <h1 className="text-2xl font-bold text-[#14181F] mt-6 mb-2">{job.title}</h1>
              <p className="text-sm font-medium text-[#5B6472] mb-6">{job.company?.name || 'Company not available'}</p>

              <section className="mb-6">
                <h2 className="font-bold text-[#14181F] mb-2">Job Description</h2>
                <p className="text-sm text-[#5B6472] whitespace-pre-line">{job.description}</p>
              </section>

              <section className="mb-6">
                <h2 className="font-bold text-[#14181F] mb-2">About the Company</h2>
                <p className="text-sm text-[#5B6472] whitespace-pre-line">{job.company?.description || 'Company description not available.'}</p>
              </section>

              <div className="space-y-5">
                {requirementCategories.map(([key, label]) => {
                  const requirements = job.requirements?.[key] || [];
                  return (
                    <section key={key}>
                      <h2 className="font-bold text-[#14181F] mb-2">{label}</h2>
                      {requirements.length > 0 ? (
                        <ul className="list-disc pl-5 space-y-1 text-sm text-[#5B6472]">
                          {requirements.map((requirement, index) => (
                            <li key={`${key}-${index}`}>{requirement}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-[#5B6472]">None specified</p>
                      )}
                    </section>
                  );
                })}
              </div>

              <a
                href={`/apply/${job._id}`}
                className="inline-block mt-8 bg-[#2952E3] text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-[#1F3FB8] transition-colors"
              >
                Apply Now
              </a>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

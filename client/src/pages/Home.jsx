import { useEffect, useState } from 'react';
import { getJobs } from '../services/api';
import Navbar from '../components/Navbar';

export default function Home() {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    getJobs()
      .then((res) => setJobs(res.data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col">
      <Navbar />

      <section className="text-center py-24 px-6">
        <h1 className="text-4xl font-bold text-[#14181F] mb-4">
          Find Your Next Opportunity
        </h1>
        <p className="text-[#5B6472] max-w-xl mx-auto mb-8">
          Explore open roles at Various Leading Companies.
        </p>

        <div className="max-w-xl mx-auto flex bg-white border border-[#E5E8EE] rounded-2xl shadow-md hover:shadow-lg overflow-hidden focus-within:border-[#2952E3] transition-all">
          <input
            type="text"
            placeholder="Search job title or keyword..."
            className="flex-1 px-5 py-3 text-sm outline-none"
          />
          <button className="bg-[#2952E3] text-white px-6 font-medium hover:bg-[#1F3FB8] transition-colors">
            Search
          </button>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-24 flex-1 w-full">
        <h2 className="text-lg font-bold text-[#14181F] mb-6">Featured Positions</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {jobs.map((job) => (
            <div
              key={job._id}
              className="bg-white border border-[#E5E8EE] rounded-xl p-6 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <p className="text-sm text-[#5B6472] mb-1">{job.company?.name}</p>
              <h3 className="text-lg font-bold text-[#14181F] mb-3">{job.title}</h3>
              <p className="text-sm text-[#5B6472] mb-4 line-clamp-3">{job.description}</p>

              <div className="flex flex-wrap gap-2 mb-4">
                {job.requirements?.skills?.slice(0, 3).map((skill) => (
                  <span key={skill} className="text-xs bg-[#F7F8FA] border border-[#E5E8EE] px-2 py-1 rounded-full text-[#5B6472]">
                    {skill}
                  </span>
                ))}
              </div>

              
              <a href={`/apply/${job._id}`}
                className="inline-block bg-[#2952E3] text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-[#1F3FB8] transition-colors"
              >
                Apply Now
              </a>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#E5E8EE] bg-white py-6 px-6 text-center text-sm text-[#5B6472]">
        © 2026 TalentMatch. All rights reserved.
      </footer>
    </div>
  );
}
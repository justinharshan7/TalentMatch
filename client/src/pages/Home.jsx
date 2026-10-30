import { useEffect, useState, useRef } from 'react';
import { getJobs } from '../services/api';
import Navbar from '../components/Navbar';

const sortOptions = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title A–Z' },
];

export default function Home() {
  const [jobs, setJobs] = useState([]);
  const [query, setQuery] = useState('');
  const [company, setCompany] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [activeSortIndex, setActiveSortIndex] = useState(0);
  const sortRef = useRef(null);
  const sortButtonRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (sortRef.current && !sortRef.current.contains(event.target)) setSortOpen(false);
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, []);

  const openSort = () => {
    setActiveSortIndex(sortOptions.findIndex((option) => option.value === sortBy));
    setSortOpen(true);
    sortButtonRef.current?.focus();
  };

  const closeSort = () => {
    setSortOpen(false);
    sortButtonRef.current?.focus();
  };

  const selectSort = (index) => {
    setSortBy(sortOptions[index].value);
    closeSort();
  };

  const handleSortKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!sortOpen) openSort();
      else setActiveSortIndex((index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + sortOptions.length) % sortOptions.length);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActiveSortIndex(event.key === 'Home' ? 0 : sortOptions.length - 1);
      setSortOpen(true);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (sortOpen) selectSort(activeSortIndex);
      else openSort();
    } else if (sortOpen && event.key === 'Escape') {
      event.preventDefault();
      closeSort();
    } else if (sortOpen && event.key === 'Tab') {
      // Focus stays on the trigger, so normal Tab/Shift+Tab leaves the control.
      closeSort();
    }
  };

  useEffect(() => {
    getJobs()
      .then((res) => setJobs(res.data))
      .catch((err) => console.error(err));
  }, []);

  const companies = ['All', ...new Set(jobs.map((j) => j.company?.name).filter(Boolean))];

  const filteredJobs = jobs.filter((job) => {
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      job.title.toLowerCase().includes(q) ||
      job.description.toLowerCase().includes(q) ||
      job.company?.name.toLowerCase().includes(q) ||
      job.requirements?.skills?.some((s) => s.toLowerCase().includes(q));
    const matchesCompany = company === 'All' || job.company?.name === company;
    return matchesQuery && matchesCompany;
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title);
    }

    const dateA = Date.parse(a.createdAt) || 0;
    const dateB = Date.parse(b.createdAt) || 0;
    return sortBy === 'oldest' ? dateA - dateB : dateB - dateA;
  });

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col">
      <Navbar />

      <section className="text-center py-24 px-6">
        <h1 className="text-4xl font-bold text-[#14181F] mb-4">
          Find Your Next Opportunity
        </h1>
        <p className="text-[#5B6472] max-w-xl mx-auto mb-8">
          Explore open roles at various leading companies.
        </p>

        <div className="max-w-xl mx-auto flex bg-white border border-[#E5E8EE] rounded-2xl shadow-md hover:shadow-lg overflow-hidden focus-within:border-[#2952E3] transition-all">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, company or skill..."
            className="flex-1 px-5 py-3 text-sm outline-none"
          />
          <button className="bg-[#2952E3] text-white px-6 font-medium hover:bg-[#1F3FB8] transition-colors">
            Search
          </button>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-24 flex-1 w-full">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <h2 className="text-lg font-bold text-[#14181F]">
            Featured Positions ({filteredJobs.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {companies.map((c) => (
              <button
                key={c}
                onClick={() => setCompany(c)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  company === c
                    ? 'bg-[#2952E3] text-white border-[#2952E3]'
                    : 'bg-white text-[#5B6472] border-[#E5E8EE] hover:border-[#2952E3]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-6">
          <span id="job-sort-label" className="text-sm font-medium text-[#14181F]">Sort by</span>
          <div
            ref={sortRef}
            className="relative w-full sm:w-52"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setSortOpen(false);
            }}
          >
            <button
              ref={sortButtonRef}
              type="button"
              role="combobox"
              aria-labelledby="job-sort-label job-sort-value"
              aria-haspopup="listbox"
              aria-expanded={sortOpen}
              aria-controls={sortOpen ? 'job-sort-options' : undefined}
              aria-activedescendant={sortOpen ? `job-sort-${sortOptions[activeSortIndex].value}` : undefined}
              onClick={() => sortOpen ? closeSort() : openSort()}
              onKeyDown={handleSortKeyDown}
              className="w-full flex items-center justify-between gap-3 border border-[#E5E8EE] rounded-lg px-4 py-2 text-sm bg-white text-left focus-visible:outline-[#2952E3]"
            >
              <span id="job-sort-value">{sortOptions.find((option) => option.value === sortBy).label}</span>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B6472" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {sortOpen && (
              <ul id="job-sort-options" role="listbox" aria-labelledby="job-sort-label" className="absolute mt-1 w-full bg-white border border-[#E5E8EE] rounded-lg shadow-lg z-10 overflow-hidden">
                {sortOptions.map((option, index) => (
                  <li
                    key={option.value}
                    id={`job-sort-${option.value}`}
                    role="option"
                    aria-selected={sortBy === option.value}
                    tabIndex={-1}
                    onClick={() => selectSort(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onKeyDown={handleSortKeyDown}
                    className={`px-4 py-2 text-sm cursor-pointer hover:bg-[#F7F8FA] ${
                      sortBy === option.value ? 'bg-[#F7F8FA] font-medium text-[#2952E3]' : 'text-[#14181F]'
                    } ${activeSortIndex === index ? 'ring-2 ring-inset ring-[#2952E3]' : ''}`}
                  >
                    {option.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {filteredJobs.length === 0 && (
          <p className="text-sm text-[#5B6472] text-center py-12">No jobs match your search.</p>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {sortedJobs.map((job) => (
            <div
              key={job._id}
              className="bg-white border border-[#E5E8EE] rounded-xl p-6 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <p className="text-sm text-[#5B6472] mb-1">{job.company?.name}</p>
              <h3 className="text-lg font-bold text-[#14181F] mb-3">
                <a href={`/jobs/${job._id}`} className="hover:text-[#2952E3] hover:underline">
                  {job.title}
                </a>
              </h3>
              <p className="text-sm text-[#5B6472] mb-4 line-clamp-3 whitespace-pre-line">{job.description}</p>

              <div className="flex flex-wrap gap-2 mb-4">
                {job.requirements?.skills?.slice(0, 3).map((skill) => (
                  <span key={skill} className="text-xs bg-[#F7F8FA] border border-[#E5E8EE] px-2 py-1 rounded-full text-[#5B6472]">
                    {skill}
                  </span>
                ))}
              </div>

              <a
                href={`/apply/${job._id}`}
                className="inline-block bg-[#2952E3] text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-[#1F3FB8] transition-colors"
              >
                Apply Now
              </a>
              <a
                href={`/jobs/${job._id}`}
                className="inline-block ml-4 text-sm font-medium text-[#2952E3] hover:underline"
              >
                View Details
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

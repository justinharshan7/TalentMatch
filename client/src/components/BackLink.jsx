export default function BackLink({ to, label }) {
  return (
    
    <a href={to}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5B6472] hover:text-[#2952E3] transition-colors group"
    >
      <svg
        width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="transition-transform group-hover:-translate-x-0.5"
      >
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
      {label}
    </a>
  );
}
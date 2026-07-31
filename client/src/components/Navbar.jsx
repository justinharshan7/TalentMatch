import { useState, useEffect, useRef } from 'react';

export default function Navbar() {
  const isLoggedIn = !!localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/hr-login';
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <nav className="flex items-center justify-between px-8 py-5 border-b border-[#E5E8EE] bg-white relative">
      <a href="/" className="text-xl font-bold text-[#2952E3]">TalentMatch</a>

      {isLoggedIn ? (
        <div className="flex items-center gap-4">
          <a href="/hr-dashboard" className="text-sm font-medium text-[#14181F] hover:text-[#2952E3]">
            Dashboard
          </a>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-9 h-9 rounded-full bg-[#2952E3] text-white text-sm font-bold flex items-center justify-center"
            >
              {initials}
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-[#E5E8EE] rounded-lg shadow-lg py-2 z-10">
                <div className="px-4 py-2 border-b border-[#E5E8EE]">
                  <p className="text-sm font-medium text-[#14181F]">{user?.name}</p>
                  <p className="text-xs text-[#5B6472]">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-[#F7F8FA]"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <a href="/hr-login" className="text-sm font-medium text-[#14181F] hover:text-[#2952E3]">
          HR Login
        </a>
      )}
    </nav>
  );
}
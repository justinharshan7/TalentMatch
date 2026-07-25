export default function Navbar() {
  const isLoggedIn = !!localStorage.getItem('token');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/hr-login';
  };

  return (
    <nav className="flex items-center justify-between px-8 py-5 border-b border-[#E5E8EE] bg-white">
      <a href="/" className="text-xl font-bold text-[#2952E3]">TalentMatch</a>
      {isLoggedIn ? (
        <button onClick={handleLogout} className="text-sm font-medium text-[#5B6472] hover:text-[#2952E3]">
          Logout
        </button>
      ) : (
        <a href="/hr-login" className="text-sm font-medium text-[#14181F] hover:text-[#2952E3]">
          HR Login
        </a>
      )}
    </nav>
  );
}
import { useState } from 'react';
import { loginHR } from '../services/api';

export default function HRLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await loginHR({ email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      window.location.href = '/hr-dashboard';
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-white border border-[#E5E8EE] rounded-xl p-8">
        <h1 className="text-xl font-bold text-[#14181F] mb-1">HR Login</h1>
        <p className="text-sm text-[#5B6472] mb-6">Sign in to manage your jobs and candidates.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[#14181F] block mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[#E5E8EE] rounded-lg px-4 py-2 text-sm outline-none focus:border-[#2952E3]"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#14181F] block mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-[#E5E8EE] rounded-lg px-4 py-2 text-sm outline-none focus:border-[#2952E3]"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2952E3] text-white font-medium py-2.5 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <div className="mt-6 border-t border-[#E5E8EE] pt-5 text-center">
          <p className="text-sm text-[#5B6472] mb-2">Looking for a job?</p>
          <a href="/" className="text-sm font-medium text-[#2952E3] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2952E3]">
            Continue as Guest
          </a>
          <p className="text-xs text-[#5B6472] mt-2">Browse vacancies and submit your CV.</p>
        </div>
      </div>
    </div>
  );
}

import { useRef, useState } from 'react';
import { registerHR } from '../services/api';

const inputClass = 'w-full border border-[#E5E8EE] rounded-lg px-4 py-2 text-sm outline-none focus:border-[#2952E3]';
const labelClass = 'text-sm font-medium text-[#14181F] block mb-1';

export default function HRRegister() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', companyName: '', companyDescription: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const submitting = useRef(false);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    if (!form.name.trim() || !form.companyName.trim() || !form.companyDescription.trim()) {
      setError('Enter your name, company name and company description.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }
    if (new Blob([form.password]).size > 72) {
      setError('Password is too long. Please use a shorter password.');
      return;
    }
    submitting.current = true;
    setLoading(true);
    try {
      await registerHR({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        companyName: form.companyName.trim(),
        companyDescription: form.companyDescription.trim()
      });
      // Sign in through the existing login flow rather than replacing any active session.
      setForm({ name: '', email: '', password: '', confirmPassword: '', companyName: '', companyDescription: '' });
      setRegistered(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to create your account. Please try again.');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm bg-white border border-[#E5E8EE] rounded-xl p-8">
        {registered ? (
          <section aria-live="polite">
            <h1 className="text-xl font-bold text-[#14181F] mb-2">Your account is ready</h1>
            <p className="text-sm text-[#5B6472] mb-6">Your company and HR account have been created. Sign in to start posting jobs and reviewing applications.</p>
            <a href="/hr-login" className="block w-full bg-[#2952E3] text-white text-sm text-center font-medium py-2.5 rounded-lg hover:bg-[#1F3FB8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2952E3]">Sign in</a>
          </section>
        ) : (
          <>
            <h1 className="text-xl font-bold text-[#14181F] mb-1">HR Registration</h1>
            <p className="text-sm text-[#5B6472] mb-6">Create your company and its first HR account.</p>
            <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
              <fieldset disabled={loading} className="space-y-4">
                <legend className="sr-only">Your HR account and company details</legend>
                <div>
                  <label htmlFor="register-name" className={labelClass}>Full Name</label>
                  <input id="register-name" name="name" autoComplete="name" required maxLength={100} value={form.name} onChange={updateField} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="register-email" className={labelClass}>Email</label>
                  <input id="register-email" name="email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={updateField} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="register-password" className={labelClass}>Password</label>
                  <input id="register-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} aria-describedby="register-password-help" value={form.password} onChange={updateField} className={inputClass} />
                  <p id="register-password-help" className="text-xs text-[#5B6472] mt-2">Use at least 8 characters.</p>
                </div>
                <div>
                  <label htmlFor="register-confirm-password" className={labelClass}>Confirm Password</label>
                  <input id="register-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={form.confirmPassword} onChange={updateField} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="register-company" className={labelClass}>Company Name</label>
                  <input id="register-company" name="companyName" autoComplete="organization" required maxLength={100} value={form.companyName} onChange={updateField} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="register-description" className={labelClass}>Company Description</label>
                  <textarea id="register-description" name="companyDescription" required maxLength={2000} rows={3} aria-describedby="register-company-help" value={form.companyDescription} onChange={updateField} className={inputClass} />
                  <p id="register-company-help" className="text-xs text-[#5B6472] mt-2">Describe your company in up to 2,000 characters. Company details will be shown with your jobs.</p>
                </div>
              </fieldset>
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading} className="w-full bg-[#2952E3] text-white font-medium py-2.5 rounded-lg disabled:opacity-50 hover:bg-[#1F3FB8] transition-colors">
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
            <p className="mt-5 text-center text-sm text-[#5B6472]">Already have an HR account?{' '}<a href="/hr-login" className="font-medium text-[#2952E3] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2952E3]">Sign in</a></p>
          </>
        )}
        <div className="mt-6 border-t border-[#E5E8EE] pt-5 text-center">
          <p className="text-sm text-[#5B6472] mb-2">Looking for a job?</p>
          <a href="/" className="text-sm font-medium text-[#2952E3] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2952E3]">Continue as Guest</a>
          <p className="text-xs text-[#5B6472] mt-2">Browse vacancies and submit your CV.</p>
        </div>
      </div>
    </div>
  );
}

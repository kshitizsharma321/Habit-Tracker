import { useState } from 'react';
import { requestPasswordReset } from '../api/authApi';
import { Input } from './ui/input';
import { notify } from '../lib/toast';

// The server always answers the same 200 whether the account exists or not
// (anti-enumeration), so this screen has exactly one success state.
export default function ForgotPasswordPage({ onBack }) {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await requestPasswordReset(usernameOrEmail.trim());
      setSent(true);
    } catch (err) {
      notify.error("Couldn't send the request", err.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-sm ht-card p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔑</div>
          <h1 className="text-xl font-bold text-text-primary">Forgot your password?</h1>
          <p className="text-text-secondary text-sm mt-1">
            {sent
              ? 'Check your inbox'
              : "Enter your username or email and we'll send a reset link"}
          </p>
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <p className="text-text-secondary text-sm leading-relaxed">
              If that account has an email on file, a reset link is on its way.
              It works once and expires in <strong>30 minutes</strong>.
            </p>
            <p className="text-text-secondary text-xs">
              Nothing arrived? Check spam, or ask an admin to reset your password.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Username or email
              </label>
              <Input
                type="text"
                required
                autoFocus
                autoComplete="username"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                className="h-10"
                placeholder="yourname or you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-ht-accent text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-text-secondary mt-6">
          <button onClick={onBack} className="text-ht-accent hover:underline font-medium">
            Back to sign in
          </button>
        </p>
      </div>
    </div>
  );
}

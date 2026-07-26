import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api/authApi';
import { PasswordInput } from './ui/password-input';
import { notify } from '../lib/toast';

// Landing page for the emailed reset link (/reset-password?token=…).
// Mounted OUTSIDE AuthGate — the visitor is logged out by definition.
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPw.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPw !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await resetPassword({ token, newPassword: newPw });
      setDone(true);
      notify.success('Password updated', 'Sign in with your new password');
    } catch (err) {
      setError(err.message || 'Could not reset the password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-sm ht-card p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔑</div>
          <h1 className="text-xl font-bold text-text-primary">
            {done ? 'Password updated' : 'Choose a new password'}
          </h1>
          {!done && !token && (
            <p className="text-text-secondary text-sm mt-1">
              This link is missing its reset token.
            </p>
          )}
        </div>

        {done ? (
          <div className="space-y-4 text-center">
            <p className="text-text-secondary text-sm">
              You&apos;re all set — sign in with your new password.
            </p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="w-full py-2.5 rounded-lg bg-ht-accent text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Go to sign in
            </button>
          </div>
        ) : !token ? (
          <div className="space-y-4 text-center">
            <p className="text-text-secondary text-sm leading-relaxed">
              Open the link from your email again, or request a fresh one from the
              sign-in page.
            </p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="w-full py-2.5 rounded-lg bg-ht-accent text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordInput
              required
              autoFocus
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="New password (min 6 chars)"
              className="h-10"
            />
            <PasswordInput
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              className="h-10"
            />

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-ht-accent text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Reset password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

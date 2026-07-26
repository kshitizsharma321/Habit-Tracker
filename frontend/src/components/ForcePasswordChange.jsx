import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { changePassword } from '../api/authApi';
import { PasswordInput } from './ui/password-input';
import { notify } from '../lib/toast';

// Shown when an admin has reset the user's password (user.mustChangePassword).
// The temp password already proved identity at login, so only a new password is
// needed — the backend skips the currentPassword check while the flag is set.
export default function ForcePasswordChange() {
  const { refreshUser, logout } = useAuth();
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPw.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPw !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await changePassword({ newPassword: newPw });
      await refreshUser();
      notify.success('Password updated', "You're all set — welcome back!");
    } catch (err) {
      setError(err.message || 'Could not update the password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-sm ht-card p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔑</div>
          <h1 className="text-xl font-bold text-text-primary">Set a new password</h1>
          <p className="text-text-secondary text-sm mt-1">
            Your password was reset by an admin. Choose a new one to continue.
          </p>
        </div>

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
            {loading ? 'Saving…' : 'Save & Continue'}
          </button>
        </form>

        <p className="text-center text-sm text-text-secondary mt-6">
          <button onClick={logout} className="hover:underline">Sign out instead</button>
        </p>
      </div>
    </div>
  );
}

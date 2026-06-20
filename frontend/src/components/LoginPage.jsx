import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { Input } from './ui/input';
import { PasswordInput } from './ui/password-input';
import { notify } from '../lib/toast';

export default function LoginPage({ onSwitch }) {
  const { login, loginWithGoogle } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ username, password });
    } catch (err) {
      const msg = err.message || 'Login failed';
      setError(msg);
      notify.error("Couldn't sign in", msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSuccess(credentialResponse) {
    setError('');
    try {
      await loginWithGoogle(credentialResponse.credential);
    } catch (err) {
      const msg = err.message || 'Google sign-in failed';
      setError(msg);
      notify.error('Google sign-in failed', msg);
    }
  }

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-sm ht-card p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🌿</div>
          <h1 className="text-2xl font-bold text-text-primary">Habit Tracker</h1>
          <p className="text-text-secondary text-sm mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Username</label>
            <Input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-10"
              placeholder="Enter your username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Password</label>
            <PasswordInput
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-ht-accent text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {googleClientId && (
          <div className="mt-4">
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border-col" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card-bg px-2 text-text-secondary">or continue with</span>
              </div>
            </div>
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google sign-in failed')}
                theme="outline"
                size="large"
                shape="rectangular"
                text="signin_with"
              />
            </div>
          </div>
        )}

        <p className="text-center text-sm text-text-secondary mt-6">
          Don&apos;t have an account?{' '}
          <button
            onClick={onSwitch}
            className="text-ht-accent hover:underline font-medium"
          >
            Register
          </button>
        </p>
      </div>
    </div>
  );
}

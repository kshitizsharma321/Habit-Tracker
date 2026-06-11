import { useState, useEffect, useRef } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { checkUsernameAvailability } from '../api/authApi';

export default function RegisterPage({ onSwitch }) {
  const { register, loginWithGoogle } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState(null); // null | 'checking' | 'available' | 'taken' | string (error)
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!username) { setUsernameStatus(null); return; }
    if (username.length < 3) { setUsernameStatus('min'); return; }

    setUsernameStatus('checking');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailability(username);
        if (result.error) setUsernameStatus(result.error);
        else setUsernameStatus(result.available ? 'available' : 'taken');
      } catch {
        setUsernameStatus(null);
      }
    }, 500);

    return () => clearTimeout(debounceRef.current);
  }, [username]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (usernameStatus !== 'available') {
      setError('Please choose a valid, available username');
      return;
    }
    setLoading(true);
    try {
      await register({ username, email: email || undefined, password, name });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSuccess(credentialResponse) {
    setError('');
    try {
      await loginWithGoogle(credentialResponse.credential);
    } catch (err) {
      setError(err.message);
    }
  }

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const usernameHint = (() => {
    if (!usernameStatus) return null;
    if (usernameStatus === 'checking') return { text: 'Checking…', color: 'text-text-secondary' };
    if (usernameStatus === 'available') return { text: '✓ Available', color: 'text-green-500' };
    if (usernameStatus === 'taken') return { text: 'Username already taken', color: 'text-red-500' };
    if (usernameStatus === 'min') return { text: 'At least 3 characters', color: 'text-text-secondary' };
    return { text: usernameStatus, color: 'text-red-500' };
  })();

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-sm ht-card p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🌿</div>
          <h1 className="text-2xl font-bold text-text-primary">Habit Tracker</h1>
          <p className="text-text-secondary text-sm mt-1">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border-col bg-bg-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-ht-accent"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Username</label>
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              className="w-full px-3 py-2 rounded-lg border border-border-col bg-bg-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-ht-accent"
              placeholder="your_username"
            />
            {usernameHint && (
              <p className={`text-xs mt-1 ${usernameHint.color}`}>{usernameHint.text}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border-col bg-bg-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-ht-accent"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border-col bg-bg-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-ht-accent"
              placeholder="At least 6 characters"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || usernameStatus === 'checking' || usernameStatus === 'taken'}
            className="w-full py-2.5 rounded-lg bg-ht-accent text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Create Account'}
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
                text="signup_with"
              />
            </div>
          </div>
        )}

        <p className="text-center text-sm text-text-secondary mt-6">
          Already have an account?{' '}
          <button
            onClick={onSwitch}
            className="text-ht-accent hover:underline font-medium"
          >
            Sign In
          </button>
        </p>
      </div>
    </div>
  );
}

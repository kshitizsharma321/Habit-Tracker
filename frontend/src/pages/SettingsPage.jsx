import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { changePassword, checkUsernameAvailability } from '../api/authApi';
import NotificationSettings from '../components/NotificationSettings/NotificationSettings';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Card } from '../components/ui/card';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const navigate = useNavigate();
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5m7-7-7 7 7 7" />
          </svg>
        </Button>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
      </div>

      <ProfileSection />
      <PasswordSection />
      <NotificationSection />
      <ThemeSection />
      <SignOutSection />
    </div>
  );
}

function ProfileSection() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [username, setUsername] = useState(user?.username || '');
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    const trimmed = username.trim();
    if (!trimmed || trimmed === user?.username) { setUsernameStatus(null); return; }
    if (trimmed.length < 3) { setUsernameStatus('min'); return; }

    setUsernameStatus('checking');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailability(trimmed);
        if (result.error) setUsernameStatus(result.error);
        else setUsernameStatus(result.available ? 'available' : 'taken');
      } catch {
        setUsernameStatus(null);
      }
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [username, user?.username]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (usernameStatus === 'taken' || usernameStatus === 'checking') return;
    setLoading(true);
    try {
      const updates = { name, email };
      if (username.trim() && username.trim() !== user?.username) updates.username = username.trim();
      await updateUser(updates);
      toast.success('Profile updated');
      setUsernameStatus(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  const usernameHint = (() => {
    if (!usernameStatus) return null;
    if (usernameStatus === 'checking') return { text: 'Checking…', color: 'text-muted-foreground' };
    if (usernameStatus === 'available') return { text: '✓ Available', color: 'text-green-500' };
    if (usernameStatus === 'taken') return { text: 'Already taken', color: 'text-destructive' };
    if (usernameStatus === 'min') return { text: 'At least 3 characters', color: 'text-muted-foreground' };
    return { text: usernameStatus, color: 'text-destructive' };
  })();

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-foreground mb-4">👤 Profile</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Username</Label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            autoComplete="username"
          />
          {usernameHint && (
            <p className={`text-xs mt-1 ${usernameHint.color}`}>{usernameHint.text}</p>
          )}
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button type="submit" disabled={loading || usernameStatus === 'checking' || usernameStatus === 'taken'} className="w-full">
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    </Card>
  );
}

function PasswordSection() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user?.googleId && !user?.password) {
    return (
      <Card className="p-5">
        <h2 className="font-semibold text-foreground mb-4">🔑 Password</h2>
        <p className="text-sm text-muted-foreground">Google accounts use Google authentication.</p>
      </Card>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPw !== confirm) { setError('Passwords do not match'); return; }
    if (newPw.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await changePassword({ currentPassword: current, newPassword: newPw });
      toast.success('Password changed');
      setCurrent(''); setNewPw(''); setConfirm('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-foreground mb-4">🔑 Password</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input type="password" required placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Input type="password" required minLength={6} placeholder="New password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        <Input type="password" required placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">{loading ? 'Changing...' : 'Change Password'}</Button>
      </form>
    </Card>
  );
}

function NotificationSection() {
  return (
    <Card className="p-5">
      <h2 className="font-semibold text-foreground mb-4">🔔 Daily Reminders</h2>
      <NotificationSettings />
    </Card>
  );
}

function ThemeSection() {
  const { toggleTheme } = useTheme();
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const isDark = currentTheme === 'dark';

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">🎨 Theme</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">☀️</span>
          <Switch checked={isDark} onCheckedChange={toggleTheme} />
          <span className="text-sm text-muted-foreground">🌙</span>
        </div>
      </div>
    </Card>
  );
}

function SignOutSection() {
  const { logout } = useAuth();
  return (
    <div className="pt-4">
      <Button variant="destructive" className="w-full" onClick={logout}>Sign Out</Button>
    </div>
  );
}

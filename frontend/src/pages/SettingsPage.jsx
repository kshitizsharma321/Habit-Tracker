import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { changePassword, checkUsernameAvailability, exportData } from '../api/authApi';
import NotificationSettings from '../components/NotificationSettings/NotificationSettings';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { PasswordInput } from '../components/ui/password-input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Card } from '../components/ui/card';
import { notify } from '../lib/toast';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
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
      {!user?.isAdmin && <NotificationSection />}
      <ThemeSection />
      {!user?.isAdmin && <DataExportSection />}
      <SignOutSection />
      {!user?.isAdmin && <DangerSection />}
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
    if (trimmed === (user?.username || '')) { setUsernameStatus(null); return; }
    if (!trimmed) { setUsernameStatus('empty'); return; }
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
    if (!username.trim()) {
      notify.error('Username required', 'Please enter a username before saving.');
      return;
    }
    if (usernameStatus === 'taken' || usernameStatus === 'checking' || usernameStatus === 'empty' || usernameStatus === 'min') return;
    setLoading(true);
    try {
      const updates = { name };
      // Only send email when it actually changed; empty string → null (clears it)
      const currentEmail = user?.email || '';
      if (email !== currentEmail) updates.email = email.trim() || null;
      if (username.trim() && username.trim() !== user?.username) updates.username = username.trim();
      await updateUser(updates);
      notify.success('Profile updated', 'Your changes have been saved.');
      setUsernameStatus(null);
    } catch (err) {
      notify.error("Couldn't update profile", err.message);
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
    if (usernameStatus === 'empty') return { text: 'Username cannot be empty', color: 'text-destructive' };
    return { text: usernameStatus, color: 'text-destructive' };
  })();

  const saveDisabled =
    loading ||
    usernameStatus === 'checking' ||
    usernameStatus === 'taken' ||
    usernameStatus === 'empty' ||
    usernameStatus === 'min';

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
        <Button type="submit" disabled={saveDisabled} className="w-full">
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
    if (!current) { setError('Current password is required'); return; }
    if (!newPw) { setError('New password is required'); return; }
    if (newPw !== confirm) { setError('Passwords do not match'); return; }
    if (newPw.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await changePassword({ currentPassword: current, newPassword: newPw });
      notify.success('Password changed', 'Use your new password next time you sign in.');
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
        <PasswordInput placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <PasswordInput placeholder="New password (min 6 chars)" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        <PasswordInput placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
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
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

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

function DataExportSection() {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { csv, filename, message, entryCount } = await exportData();
      if (!csv) {
        notify.info('Nothing to export yet', message || 'Log a few entries first.');
        return;
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify.success('Data exported', `${entryCount} entries downloaded as CSV.`);
    } catch (err) {
      notify.error('Export failed', err.message || 'Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-foreground mb-1">📦 Your data</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Download everything — all habits and every logged entry — as a single CSV file.
      </p>
      <Button variant="outline" onClick={handleExport} disabled={exporting}>
        {exporting ? 'Preparing…' : '⬇️ Download my data'}
      </Button>
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

function DangerSection() {
  const { deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      navigate('/');
    } catch (err) {
      notify.error("Couldn't delete account", err.message || 'Please try again.');
      setDeleting(false);
      setOpen(false);
    }
  };

  return (
    <Card className="p-5" style={{ borderColor: 'var(--danger-color)' }}>
      <h2 className="font-semibold text-foreground mb-1">⚠️ Delete account</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Permanently delete your account, habits, entries and reminders. A final backup snapshot
        is kept so an admin can recover the account if this was a mistake.
      </p>
      <Button variant="destructive" onClick={() => setOpen(true)}>Delete my account</Button>

      <Dialog open={open} onOpenChange={(o) => { if (!deleting) setOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account?</DialogTitle>
            <DialogDescription>
              This permanently deletes your account and all associated data. A final backup
              snapshot is kept — contact an admin if you ever want the account recovered.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete forever'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

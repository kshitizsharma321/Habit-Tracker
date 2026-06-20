import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import {
  fetchAdminStats,
  fetchAdminUsers,
  deleteAdminUser,
  fetchAdminUserHabits,
  fetchAdminUserBackup,
  fetchOrphanedBackups,
  downloadUserBackup,
  restoreFromBackup,
  restoreFromUploadedCsv,
  generateUserBackup,
  deleteUserBackup,
} from '../api/adminApi';
import { useAuth } from '../contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../components/ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../components/ui/select';
import { notify } from '../lib/toast';

const CSV_COLUMNS = [
  { name: 'Username', required: false },
  { name: 'Habit Name', required: true },
  { name: 'Tracking Type', required: false },
  { name: 'Unit', required: false },
  { name: 'Color', required: false },
  { name: 'Icon', required: false },
  { name: 'Goal Enabled', required: false },
  { name: 'Goal Value', required: false },
  { name: 'Goal Direction', required: false },
  { name: 'Date', required: true },
  { name: 'Value', required: true },
];

const CSV_EXAMPLE_ROWS = [
  ['@alice', 'Running', 'quantity', 'km', '#f97316', '🏃', 'true', '5', 'at_least', '2026-06-01', '4'],
  ['@alice', 'Screen Time', 'quantity', 'hours', '#ef4444', '📱', 'true', '2', 'at_most', '2026-06-01', '1.5'],
  ['@alice', 'Exercise', 'completion', '', '#22c55e', '🏋️', 'false', '', '', '2026-06-01', 'yes'],
];

// ── Generic confirm modal ─────────────────────────────────────────────────────
function ConfirmDialog({ open, title, description, confirmLabel = 'Confirm', variant = 'destructive', onConfirm, onClose, isPending }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button variant={variant} onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Drag-and-drop CSV zone ────────────────────────────────────────────────────
function CsvDropZone({ file, onFile }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handle = (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) {
      notify.error('Invalid file', 'Please upload a .csv file.');
      return;
    }
    onFile(f);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handle(e.dataTransfer.files[0]); }}
      className="relative flex flex-col items-center justify-center gap-2 rounded-xl p-8 cursor-pointer transition-colors select-none"
      style={{
        border: `2px dashed ${dragOver ? 'var(--accent-color)' : 'var(--border-color)'}`,
        background: dragOver
          ? 'color-mix(in srgb, var(--accent-color) 6%, var(--bg-secondary))'
          : 'var(--bg-secondary)',
      }}
    >
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => handle(e.target.files[0])} />
      <span className="text-3xl">📂</span>
      {file ? (
        <>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{file.name}</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {(file.size / 1024).toFixed(1)} KB — click to change
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Drop CSV here or click to browse</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Only .csv files accepted</p>
        </>
      )}
    </div>
  );
}

// ── User row with expandable habits ──────────────────────────────────────────
function UserRow({ u, currentUserId, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  const { data: habits, isLoading: habitsLoading } = useQuery({
    queryKey: ['admin-user-habits', u._id],
    queryFn: () => fetchAdminUserHabits(u._id),
    enabled: expanded,
    staleTime: 30_000,
  });

  return (
    <>
      <tr className="border-b border-border/50">
        <td className="py-3 pr-4">
          <button onClick={() => setExpanded((x) => !x)} className="flex items-center gap-2 text-left">
            <span className="text-base w-4">{expanded ? '▾' : '▸'}</span>
            <div>
              <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                {u.username ? `@${u.username}` : '—'}
              </p>
              {u.name && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{u.name}</p>}
            </div>
          </button>
        </td>
        <td className="py-3 pr-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{u.email || '—'}</td>
        <td className="py-3 pr-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {new Date(u.createdAt).toLocaleDateString()}
        </td>
        <td className="py-3">
          <Button
            variant="destructive"
            size="sm"
            disabled={currentUserId === u._id}
            onClick={() => onDelete(u)}
          >
            Delete
          </Button>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-border/20 bg-muted/20">
          <td colSpan={4} className="py-2 pl-10 pr-4">
            {habitsLoading ? (
              <div className="flex gap-2 py-1">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            ) : !habits?.length ? (
              <p className="text-xs py-1" style={{ color: 'var(--text-secondary)' }}>No habits yet</p>
            ) : (
              <div className="flex flex-wrap gap-2 py-1">
                {habits.map((h) => (
                  <span
                    key={h._id}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      background: `color-mix(in srgb, ${h.color} 15%, var(--bg-secondary))`,
                      color: h.color,
                      border: `1px solid color-mix(in srgb, ${h.color} 30%, transparent)`,
                    }}
                  >
                    {h.icon} {h.name}
                  </span>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null); // { userId, label }
  const [deleteBackupTarget, setDeleteBackupTarget] = useState(null); // { userId, label }
  const [orphanTarget, setOrphanTarget] = useState(null); // { userId, username } — recover deleted account
  const [orphanPassword, setOrphanPassword] = useState('');
  const [csvPassword, setCsvPassword] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null); // { text, rows, grouped }
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Only admins should ever hit these endpoints. The route guard below redirects
  // non-admins, but it runs after these hooks — so gate the fetches on the role too.
  const isAdmin = !!user?.isAdmin;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: fetchAdminStats,
    enabled: isAdmin,
  });
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchAdminUsers,
    enabled: isAdmin,
  });
  const { data: userBackup, isLoading: backupLoading } = useQuery({
    queryKey: ['admin-user-backup', selectedUserId],
    queryFn: () => fetchAdminUserBackup(selectedUserId),
    enabled: isAdmin && !!selectedUserId,
  });
  const { data: orphanedBackups = [] } = useQuery({
    queryKey: ['admin-orphaned-backups'],
    queryFn: fetchOrphanedBackups,
    enabled: isAdmin,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminUser,
    onSuccess: (_, deletedId) => {
      // If the deleted user was selected in the Backup tab, clear the selection
      if (selectedUserId === deletedId) setSelectedUserId('');
      queryClient.invalidateQueries({ queryKey: ['admin-user-backup', deletedId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orphaned-backups'] });
      notify.success('User deleted', 'Their habits and entries were removed — their backup was kept for recovery.');
      setDeleteTarget(null);
    },
    onError: (err) => { notify.error("Couldn't delete user", err.message); setDeleteTarget(null); },
  });

  const restoreMutation = useMutation({
    mutationFn: restoreFromBackup,
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orphaned-backups'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-backup', variables.userId] });
      const recreated = res.recreated ? ' · account recreated' : '';
      notify.success('Backup restored', `${res.restored} entries restored${res.errors ? ` · ${res.errors} skipped` : ''}${recreated}.`);
      setRestoreTarget(null);
      setOrphanTarget(null);
      setOrphanPassword('');
    },
    onError: (err) => notify.error('Restore failed', err.message),
  });

  const csvRestoreMutation = useMutation({
    mutationFn: ({ csvText, password }) => restoreFromUploadedCsv(csvText, password),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orphaned-backups'] });
      const recreated = res.recreated ? ` · ${res.recreated} account(s) recreated` : '';
      notify.success('Import complete', `${res.restored} entries imported${res.errors ? ` · ${res.errors} skipped` : ''}${recreated}.`);
      setCsvFile(null);
      setCsvPreview(null);
      setCsvPassword('');
    },
    onError: (err) => notify.error('Import failed', err.message),
  });

  const generateBackupMutation = useMutation({
    mutationFn: generateUserBackup,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-backup', selectedUserId] });
      notify.success('Backup generated', `${res.date} · ${res.entryCount} ${res.entryCount === 1 ? 'entry' : 'entries'} saved.`);
    },
    onError: (err) => notify.error("Couldn't generate backup", err.message || 'Please try again.'),
  });

  const deleteBackupMutation = useMutation({
    mutationFn: ({ userId }) => deleteUserBackup(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-backup', selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['admin-orphaned-backups'] });
      notify.success('Backup deleted', 'The backup was removed.');
      setDeleteBackupTarget(null);
    },
    onError: (err) => { notify.error("Couldn't delete backup", err.message || 'Please try again.'); setDeleteBackupTarget(null); },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['admin-stats'] }),
        queryClient.refetchQueries({ queryKey: ['admin-users'] }),
        selectedUserId
          ? queryClient.refetchQueries({ queryKey: ['admin-user-backup', selectedUserId] })
          : Promise.resolve(),
      ]);
      notify.success('Data refreshed', 'Showing the latest numbers.');
    } catch (err) {
      notify.error('Refresh failed', err.message || 'Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!user?.isAdmin) return <Navigate to="/" replace />;

  const selectedUser = users.find((u) => u._id === selectedUserId);

  // Download a backup via Supabase signed URL
  const handleDownload = async (userId) => {
    setIsDownloading(true);
    try {
      const { signedUrl } = await downloadUserBackup(userId);
      const a = document.createElement('a');
      a.href = signedUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      notify.error('Download failed', err.message || 'Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Parse CSV file for preview and validate format
  const handleCsvSelect = (file) => {
    setCsvFile(file);
    setCsvPreview(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter((l) => l.trim());
      if (lines.length < 2) { notify.error('Empty file', 'This CSV has no header row or data.'); return; }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const required = ['habit name', 'date', 'value'];
      const missing = required.filter((r) => !headers.includes(r));
      if (missing.length) {
        notify.error('Missing columns', `Required: ${missing.join(', ')}.`);
        setCsvFile(null);
        return;
      }

      // Build preview grouped by username
      const usernameIdx = headers.indexOf('username');
      const habitIdx = headers.indexOf('habit name');
      const grouped = {};
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        const uname = usernameIdx >= 0 ? (cols[usernameIdx] || '(unknown)') : '(unknown)';
        const habit = cols[habitIdx] || '?';
        if (!grouped[uname]) grouped[uname] = new Set();
        grouped[uname].add(habit);
      }
      setCsvPreview({ text, totalRows: lines.length - 1, grouped });
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🛡️</span>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Admin Dashboard</h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          {isRefreshing ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin mr-1.5" />
              Refreshing…
            </>
          ) : (
            <>🔄 Refresh</>
          )}
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="backups">Backup & Restore</TabsTrigger>
          <TabsTrigger value="upload">CSV Upload</TabsTrigger>
        </TabsList>

        {/* ── Overview ──────────────────────────────────────────────── */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'End Users', value: stats?.users ?? '—', icon: '👥', note: 'Admin excluded' },
              { label: 'Active Habits', value: stats?.habits ?? '—', icon: '📋', note: 'Across all users' },
              { label: 'Logged Entries', value: stats?.entries ?? '—', icon: '📊', note: 'All time' },
            ].map(({ label, value, icon, note }) => (
              <Card key={label} className="p-5 text-center">
                <p className="text-2xl mb-1">{icon}</p>
                {statsLoading ? (
                  <Skeleton className="h-9 w-16 mx-auto" />
                ) : (
                  <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                )}
                <p className="text-sm mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>{note}</p>
              </Card>
            ))}
          </div>

          <Card className="mt-4 p-5">
            <h3 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>ℹ️ How backups work</h3>
            <ul className="text-sm space-y-2" style={{ color: 'var(--text-secondary)' }}>
              <li>• Backup cron runs every night at <strong>23:55 IST</strong></li>
              <li>• Each user has <strong>one backup</strong> — a single CSV covering all their habits and entries</li>
              <li>• Every run (cron or manual) <strong>overwrites</strong> that one backup, so there's always exactly one latest per user — they never pile up</li>
              <li>• CSV files are stored in <strong>Supabase Storage</strong> (private bucket); MongoDB keeps only the file reference</li>
              <li>• Downloads use a short-lived signed link, so backups stay private</li>
              <li>• To restore: go to <strong>Backup & Restore</strong>, select a user, then download or restore</li>
              <li>• To import manually: go to <strong>CSV Upload</strong> and drop the backup file (format shown there)</li>
            </ul>
          </Card>
        </TabsContent>

        {/* ── Users ─────────────────────────────────────────────────── */}
        <TabsContent value="users">
          <Card className="p-4 overflow-x-auto">
            <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
              Click ▸ next to a username to see their habits.
            </p>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-semibold" style={{ color: 'var(--text-secondary)' }}>Username</th>
                  <th className="py-2 pr-4 font-semibold" style={{ color: 'var(--text-secondary)' }}>Email</th>
                  <th className="py-2 pr-4 font-semibold" style={{ color: 'var(--text-secondary)' }}>Joined</th>
                  <th className="py-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {Array.from({ length: 4 }).map((__, j) => (
                          <td key={j} className="py-3 pr-4"><Skeleton className="h-4 w-24" /></td>
                        ))}
                      </tr>
                    ))
                  : users.map((u) => (
                      <UserRow key={u._id} u={u} currentUserId={user._id} onDelete={setDeleteTarget} />
                    ))}
              </tbody>
            </table>
            {!usersLoading && users.length === 0 && (
              <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>No end users yet.</p>
            )}
          </Card>
        </TabsContent>

        {/* ── Backup & Restore ──────────────────────────────────────── */}
        <TabsContent value="backups">
          <Card className="p-5 space-y-5">
            <div>
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                🗄️ Backup & Restore
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Select a user to see their latest backup. You can download the CSV or restore
                directly from it. Restoring <strong>overwrites</strong> existing entries for matching dates.
              </p>
            </div>

            {/* Step 1 — pick user */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Step 1 — Select a user
              </p>
              {!usersLoading && users.length === 0 ? (
                <p className="text-sm py-2" style={{ color: 'var(--text-secondary)' }}>
                  No end users yet — backups will appear here once users sign up.
                </p>
              ) : (
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="— Choose a user —" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u._id} value={u._id}>
                        {u.username ? `@${u.username}` : u.email}
                        {u.name ? ` (${u.name})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Step 2 — the user's single latest backup */}
            {selectedUserId && (() => {
              const label = selectedUser?.username ? `@${selectedUser.username}` : selectedUser?.email;
              return (
              <div>
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                    Step 2 — Latest backup
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={generateBackupMutation.isPending}
                    onClick={() => generateBackupMutation.mutate(selectedUserId)}
                  >
                    {generateBackupMutation.isPending ? 'Generating…' : '⚡ Generate Now'}
                  </Button>
                </div>

                {backupLoading ? (
                  <Skeleton className="h-20 w-full rounded-xl" />
                ) : !userBackup ? (
                  <div
                    className="rounded-xl p-4 text-sm"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                  >
                    No backup yet for {label}. One is created automatically each night at 23:55 IST once the
                    user has logged an entry — or click <strong>Generate Now</strong>.
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-between rounded-xl p-3 gap-3 flex-wrap"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                  >
                    <div>
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                        Snapshot from {userBackup.date}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {userBackup.habitCount} habit{userBackup.habitCount !== 1 ? 's' : ''}
                        {userBackup.entryCount ? ` · ${userBackup.entryCount} entries` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" disabled={isDownloading}
                        onClick={() => handleDownload(selectedUserId)}>
                        ⬇️ Download
                      </Button>
                      <Button size="sm" variant="outline" disabled={restoreMutation.isPending}
                        onClick={() => setRestoreTarget({ userId: selectedUserId, label })}>
                        Restore
                      </Button>
                      <Button size="sm" variant="destructive" disabled={deleteBackupMutation.isPending}
                        onClick={() => setDeleteBackupTarget({ userId: selectedUserId, label })}>
                        🗑️
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              );
            })()}

            {/* Orphaned backups — deleted accounts that can be recovered */}
            {orphanedBackups.length > 0 && (
              <div className="pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>
                  ♻️ Orphaned backups — deleted accounts ({orphanedBackups.length})
                </p>
                <p className="text-xs mb-2.5" style={{ color: 'var(--text-secondary)' }}>
                  These users were deleted but their backup was kept. <strong>Recover</strong> recreates the account (you set a temporary password) and restores all habits + entries.
                </p>
                <div className="space-y-2">
                  {orphanedBackups.map((b) => (
                    <div
                      key={b._id}
                      className="flex items-center justify-between rounded-xl p-3 gap-3 flex-wrap"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid color-mix(in srgb, var(--danger-color) 30%, var(--border-color))' }}
                    >
                      <div>
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                          @{b.username || 'unknown'} <span className="font-normal" style={{ color: 'var(--text-secondary)' }}>(deleted)</span>
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          {b.date} · {b.habitCount} habit{b.habitCount !== 1 ? 's' : ''}
                          {b.entryCount ? ` · ${b.entryCount} entries` : ''}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" disabled={isDownloading}
                          onClick={() => handleDownload(b.userId)}>
                          ⬇️ Download
                        </Button>
                        <Button size="sm" disabled={restoreMutation.isPending}
                          onClick={() => { setOrphanPassword(''); setOrphanTarget({ userId: b.userId, username: b.username }); }}>
                          ♻️ Recover
                        </Button>
                        <Button size="sm" variant="destructive" disabled={deleteBackupMutation.isPending}
                          onClick={() => setDeleteBackupTarget({ userId: b.userId, label: `@${b.username || 'unknown'}` })}>
                          🗑️
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── CSV Upload ────────────────────────────────────────────── */}
        <TabsContent value="upload">
          <Card className="p-6 space-y-5">
            <div>
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                📤 Import from CSV
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Upload a CSV that was downloaded from the Backup & Restore tab, or any file that
                matches the backup format. Existing entries for matching dates are overwritten.
              </p>
            </div>

            {/* Format reference — table */}
            <div
              className="rounded-xl p-4"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
            >
              <p className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Expected CSV format</p>
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full text-xs border-collapse" style={{ color: 'var(--text-secondary)' }}>
                  <thead>
                    <tr>
                      {CSV_COLUMNS.map((c) => (
                        <th
                          key={c.name}
                          className="text-left font-semibold whitespace-nowrap px-2 py-1.5 border-b"
                          style={{ color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
                        >
                          {c.name}
                          <span
                            className="ml-1 font-normal"
                            style={{ color: c.required ? 'var(--danger-color)' : 'var(--text-secondary)', opacity: c.required ? 1 : 0.7 }}
                          >
                            {c.required ? '*' : '(opt)'}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {CSV_EXAMPLE_ROWS.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} className="whitespace-nowrap px-2 py-1 border-b" style={{ borderColor: 'var(--border-color)' }}>
                            {cell || <span style={{ opacity: 0.4 }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--danger-color)' }}>*</span> required · Date format <strong>YYYY-MM-DD</strong> ·
                Value is <strong>yes</strong>/<strong>no</strong> for completion habits, or a <strong>number</strong> for quantity.
              </p>
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>
                💡 Easiest: download a backup from <strong>Backup &amp; Restore</strong> and re-upload it here.
              </p>
            </div>

            <CsvDropZone file={csvFile} onFile={handleCsvSelect} />

            {/* Preview */}
            {csvPreview && (
              <div
                className="rounded-xl p-4 space-y-2"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
              >
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Preview — {csvPreview.totalRows} data rows
                </p>
                {Object.entries(csvPreview.grouped).map(([uname, habitSet]) => (
                  <div key={uname} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{uname}</span>
                    {' → '}
                    {[...habitSet].join(', ')}
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                Password for recreated accounts (optional)
              </label>
              <Input
                type="text"
                value={csvPassword}
                onChange={(e) => setCsvPassword(e.target.value)}
                placeholder="Min 6 chars — only used if the CSV's user was deleted"
                className="mt-1"
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                If a username in the CSV no longer exists, it's recreated with this password (the user can change it later). Leave blank to skip missing users.
              </p>
            </div>

            <Button
              onClick={() => csvRestoreMutation.mutate({ csvText: csvPreview.text, password: csvPassword || undefined })}
              disabled={!csvPreview || csvRestoreMutation.isPending}
            >
              {csvRestoreMutation.isPending ? 'Importing…' : '⬆️ Import & Restore'}
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete user confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete user?"
        description={
          deleteTarget
            ? `This will permanently remove @${deleteTarget.username || deleteTarget.email} — all their habits and entries will be deleted. Their backup is preserved and will appear under "Orphaned backups" so you can recover the account if needed.`
            : ''
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        onClose={() => setDeleteTarget(null)}
        isPending={deleteMutation.isPending}
      />

      {/* Restore confirmation */}
      <ConfirmDialog
        open={!!restoreTarget}
        title="Restore backup?"
        description={
          restoreTarget
            ? `Restore all habits for ${restoreTarget.label} from their latest backup. Entries for matching dates will be overwritten.`
            : ''
        }
        confirmLabel="Restore"
        variant="default"
        onConfirm={() => restoreMutation.mutate({ userId: restoreTarget.userId })}
        onClose={() => setRestoreTarget(null)}
        isPending={restoreMutation.isPending}
      />

      {/* Delete backup confirmation */}
      <ConfirmDialog
        open={!!deleteBackupTarget}
        title="Delete backup?"
        description={
          deleteBackupTarget
            ? `Permanently delete the backup for ${deleteBackupTarget.label}. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteBackupMutation.mutate({ userId: deleteBackupTarget.userId })}
        onClose={() => setDeleteBackupTarget(null)}
        isPending={deleteBackupMutation.isPending}
      />

      {/* Recover a deleted account from its orphaned backup */}
      <Dialog open={!!orphanTarget} onOpenChange={(v) => { if (!v && !restoreMutation.isPending) setOrphanTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recover @{orphanTarget?.username || 'account'}?</DialogTitle>
            <DialogDescription>
              This recreates the deleted account and restores all its habits and entries from the backup.
              Set a temporary password — the user can change it after signing in.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <Input
              type="text"
              value={orphanPassword}
              onChange={(e) => setOrphanPassword(e.target.value)}
              placeholder="Temporary password (min 6 chars)"
            />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOrphanTarget(null)} disabled={restoreMutation.isPending}>Cancel</Button>
            <Button
              onClick={() => restoreMutation.mutate({ userId: orphanTarget.userId, newUserPassword: orphanPassword })}
              disabled={restoreMutation.isPending || orphanPassword.length < 6}
            >
              {restoreMutation.isPending ? 'Recovering…' : 'Recover account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

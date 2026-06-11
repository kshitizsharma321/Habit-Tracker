import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import {
  fetchAdminStats,
  fetchAdminUsers,
  deleteAdminUser,
  updateAdminRole,
  restoreAdminData,
  fetchAdminBackups,
  restoreFromBackup,
} from '../api/adminApi';
import { useAuth } from '../contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [csvFile, setCsvFile] = useState(null);

  const { data: stats } = useQuery({ queryKey: ['admin-stats'], queryFn: fetchAdminStats });
  const { data: users } = useQuery({ queryKey: ['admin-users'], queryFn: fetchAdminUsers });
  const { data: backups = [], isLoading: backupsLoading } = useQuery({
    queryKey: ['admin-backups'],
    queryFn: fetchAdminBackups,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast.success('User deleted');
    },
    onError: (err) => toast.error(err.message),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, isAdmin }) => updateAdminRole(id, isAdmin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Role updated');
    },
    onError: (err) => toast.error(err.message),
  });

  const restoreMutation = useMutation({
    mutationFn: restoreAdminData,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast.success(`Restored ${res.restored} entries. Errors: ${res.errors}`);
      setCsvFile(null);
      const input = document.getElementById('csv-upload');
      if (input) input.value = '';
    },
    onError: (err) => toast.error(err.message),
  });

  const backupRestoreMutation = useMutation({
    mutationFn: restoreFromBackup,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast.success(`Restored ${res.restored} entries from ${res.backupsProcessed} habit backups`);
    },
    onError: (err) => toast.error(err.message),
  });

  if (!user?.isAdmin) return <Navigate to="/" replace />;

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) setCsvFile(file);
  };

  const handleProcessCsv = () => {
    if (!csvFile) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      // Split on actual newlines (not literal \n)
      const lines = text.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        toast.error('CSV is empty or missing headers');
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const idx = (name) => headers.indexOf(name);

      const emailIdx = idx('email');
      const habitIdx = idx('habit name');
      const typeIdx = idx('tracking type');
      const unitIdx = idx('unit');
      const colorIdx = idx('color');
      const iconIdx = idx('icon');
      const dateIdx = idx('date');
      const valueIdx = idx('value');

      if (emailIdx === -1 || habitIdx === -1 || dateIdx === -1 || valueIdx === -1) {
        toast.error('CSV must have columns: Email, Habit Name, Date, Value');
        return;
      }

      const parsedData = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < 4) continue;
        const rawValue = cols[valueIdx]?.trim();
        parsedData.push({
          email: cols[emailIdx]?.trim(),
          habitName: cols[habitIdx]?.trim(),
          trackingType: typeIdx >= 0 ? cols[typeIdx]?.trim() : undefined,
          unit: unitIdx >= 0 ? cols[unitIdx]?.trim() : undefined,
          color: colorIdx >= 0 ? cols[colorIdx]?.trim() : undefined,
          icon: iconIdx >= 0 ? cols[iconIdx]?.trim() : undefined,
          date: cols[dateIdx]?.trim(),
          value: rawValue && !isNaN(Number(rawValue)) ? Number(rawValue) : rawValue,
        });
      }

      restoreMutation.mutate(parsedData);
    };
    reader.readAsText(csvFile);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🛡️</span>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Admin Dashboard
        </h1>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="backups">Backup Restore</TabsTrigger>
          <TabsTrigger value="upload">CSV Upload</TabsTrigger>
        </TabsList>

        {/* ── Overview ──────────────────────────────────────────────────── */}
        <TabsContent value="overview">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Users', value: stats?.users ?? '—', icon: '👥' },
              { label: 'Active Habits', value: stats?.habits ?? '—', icon: '📋' },
              { label: 'Logged Entries', value: stats?.entries ?? '—', icon: '📊' },
            ].map(({ label, value, icon }) => (
              <Card key={label} className="p-5 text-center">
                <p className="text-2xl mb-1">{icon}</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Users ─────────────────────────────────────────────────────── */}
        <TabsContent value="users">
          <Card className="p-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-semibold" style={{ color: 'var(--text-secondary)' }}>Email</th>
                  <th className="py-2 pr-4 font-semibold" style={{ color: 'var(--text-secondary)' }}>Name</th>
                  <th className="py-2 pr-4 font-semibold" style={{ color: 'var(--text-secondary)' }}>Role</th>
                  <th className="py-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((u) => (
                  <tr key={u._id} className="border-b border-border/50">
                    <td className="py-2 pr-4" style={{ color: 'var(--text-primary)' }}>{u.email}</td>
                    <td className="py-2 pr-4" style={{ color: 'var(--text-secondary)' }}>{u.name || '—'}</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={u.isAdmin}
                          disabled={user._id === u._id}
                          onCheckedChange={(val) => roleMutation.mutate({ id: u._id, isAdmin: val })}
                        />
                        {u.isAdmin && <Badge variant="default">Admin</Badge>}
                      </div>
                    </td>
                    <td className="py-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={user._id === u._id || deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Delete ${u.email} and all their data?`)) {
                            deleteMutation.mutate(u._id);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* ── Backup Restore ────────────────────────────────────────────── */}
        <TabsContent value="backups">
          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                Restore from Stored Backup
              </h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                Daily backups are created at 23:55 IST. Select a date to restore all user data from
                that snapshot. Existing entries for matching dates will be overwritten.
              </p>

              {backupsLoading ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading backups…</p>
              ) : backups.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  No backups found. Backups are created automatically each night.
                </p>
              ) : (
                <div className="space-y-2">
                  {backups.map((b) => (
                    <div
                      key={b.date}
                      className="flex items-center justify-between rounded-lg p-3"
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div>
                        <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                          {b.date}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          {b.habitCount} habit{b.habitCount !== 1 ? 's' : ''} · {b.userCount} user{b.userCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={backupRestoreMutation.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Restore all data from backup ${b.date}?\n\nThis will overwrite existing entries for matching dates.`
                            )
                          ) {
                            backupRestoreMutation.mutate(b.date);
                          }
                        }}
                      >
                        {backupRestoreMutation.isPending ? 'Restoring…' : 'Restore'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* ── CSV Upload ────────────────────────────────────────────────── */}
        <TabsContent value="upload">
          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Restore from CSV File
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Upload a CSV exported from backups or manually created. Required headers:{' '}
              <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--bg-secondary)' }}>
                Email, Habit Name, Date, Value
              </code>
              {'. '}
              Optional:{' '}
              <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--bg-secondary)' }}>
                Tracking Type, Unit, Color, Icon
              </code>
              . Date format: <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--bg-secondary)' }}>YYYY-MM-DD</code>.
            </p>
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full rounded-md p-2 text-sm"
              style={{ border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            />
            <Button
              onClick={handleProcessCsv}
              disabled={!csvFile || restoreMutation.isPending}
            >
              {restoreMutation.isPending ? 'Processing…' : 'Upload & Restore'}
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

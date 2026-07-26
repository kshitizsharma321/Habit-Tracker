import { useEffect } from 'react';
import { NavLink, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useHabitDefinitions } from '../hooks/useHabitDefinitions';
import { setToken } from '../api/client';
import ProfileDropdown from './ProfileDropdown';
import LoadingScreen from './LoadingScreen';

// While an admin is impersonating a user, their real token is stashed here.
function ImpersonationBanner({ username }) {
  const returnToAdmin = () => {
    const adminToken = sessionStorage.getItem('ht_admin_token');
    sessionStorage.removeItem('ht_admin_token');
    if (adminToken) setToken(adminToken);
    window.location.href = '/admin';
  };
  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium text-white"
      style={{ background: 'var(--accent-color)' }}
    >
      <span>👁 Viewing as @{username}</span>
      <button
        onClick={returnToAdmin}
        className="underline underline-offset-2 hover:opacity-80"
      >
        Return to admin
      </button>
    </div>
  );
}

const HABIT_NAV = [
  { to: '/', label: 'Track', icon: '✅' },
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/manage', label: 'Habits', icon: '📋' },
];

const ADMIN_NAV = [
  { to: '/admin', label: 'Admin Panel', icon: '🛡️' },
];

export default function Layout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    definitions, isLoading: defsLoading,
    createHabit, createHabitAsync, isCreating, bulkCreateHabits,
    updateHabit, updateHabitAsync, isUpdating, deleteHabit, isDeleting,
    reorderHabits, isReordering,
  } = useHabitDefinitions();

  const isAnyMutationPending = isCreating || isUpdating || isDeleting;

  // Admin users are redirected away from habit routes to /admin
  useEffect(() => {
    if (!user?.isAdmin) return;
    const habitRoutes = ['/', '/dashboard', '/manage', '/detail'];
    const isHabitRoute = habitRoutes.includes(location.pathname);
    if (isHabitRoute) navigate('/admin', { replace: true });
  }, [user, location.pathname, navigate]);

  if (loading) return <LoadingScreen message="Checking authentication" />;
  if (!user) return <Navigate to="/login" replace />;

  const navItems = user.isAdmin ? ADMIN_NAV : HABIT_NAV;
  const isImpersonating = !!sessionStorage.getItem('ht_admin_token');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {isImpersonating && <ImpersonationBanner username={user.username} />}
      {/* Header — max-w matches page content */}
      <header className="sticky top-0 z-40 bg-card border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <NavLink to={user.isAdmin ? '/admin' : '/'} className="text-xl shrink-0" aria-label="Home">
              {user.isAdmin ? '🛡️' : '🌿'}
            </NavLink>
            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`
                  }
                >
                  <span className="mr-1.5">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <ProfileDropdown />
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-4xl mx-auto px-4 py-6 sm:py-8 w-full">
        <Outlet
          context={{
            definitions, defsLoading,
            createHabit, createHabitAsync, isCreating, bulkCreateHabits,
            updateHabit, updateHabitAsync, isUpdating, deleteHabit, isDeleting,
            reorderHabits, isReordering,
          }}
        />
      </main>

      {/* Global loading overlay — prevents duplicate submissions */}
      {isAnyMutationPending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
        >
          <div
            className="flex flex-col items-center gap-3 rounded-2xl px-8 py-6"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow)' }}
          >
            <div
              className="w-8 h-8 rounded-full border-[3px] border-t-transparent animate-spin"
              style={{ borderColor: `var(--accent-color)`, borderTopColor: 'transparent' }}
            />
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Saving…</p>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-40">
        <div className="flex justify-around py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg text-xs font-medium transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <div className="sm:hidden h-16" />
    </div>
  );
}

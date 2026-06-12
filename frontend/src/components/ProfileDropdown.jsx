import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function ProfileDropdown() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const hasName = !!user?.name?.trim();
  const displayName = hasName ? user.name : user?.username ? `@${user.username}` : user?.email || 'User';
  const avatarLetter = (user?.name || user?.username || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-bg-secondary border border-border-col rounded-lg px-3 py-1.5 text-sm hover:shadow-card-hover transition-shadow"
        aria-label="Profile menu"
      >
        <span className="w-6 h-6 rounded-full bg-ht-accent text-white flex items-center justify-center text-xs font-bold">
          {avatarLetter}
        </span>
        <span className="hidden sm:inline text-text-primary text-sm font-medium max-w-[100px] truncate">
          {displayName}
        </span>
        <span className="text-text-secondary text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-card-bg border border-border-col rounded-lg shadow-xl z-50 py-1">
          {/* Identity block */}
          <div className="px-3 py-2 border-b border-border-col">
            {hasName ? (
              <>
                <p className="text-sm font-medium text-text-primary truncate">{user.name}</p>
                {user?.username && (
                  <p className="text-xs text-text-secondary truncate">@{user.username}</p>
                )}
              </>
            ) : (
              <p className="text-xs text-text-secondary truncate">
                {user?.username ? `@${user.username}` : user?.email || ''}
              </p>
            )}
          </div>

          <button
            onClick={() => { setOpen(false); navigate('/settings'); }}
            className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-bg-secondary transition-colors flex items-center gap-2"
          >
            ⚙️ Settings
          </button>

          <button
            onClick={() => { setOpen(false); toggleTheme(); }}
            className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-bg-secondary transition-colors flex items-center gap-2"
          >
            {theme === 'dark' ? '☀️' : '🌙'} {theme === 'dark' ? 'Light' : 'Dark'} Mode
          </button>

          <div className="border-t border-border-col mt-1 pt-1">
            <button
              onClick={() => { setOpen(false); logout(); }}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
            >
              🚪 Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

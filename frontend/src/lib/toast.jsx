import toast from 'react-hot-toast';

// Centralised toast helper. Renders a consistent, themed card (left accent bar,
// icon, bold title, optional subtext) instead of the plain react-hot-toast string.
// Usage: notify.success('Logged!', "Today's entry is saved.")

const VARIANTS = {
  success: { icon: '✅', accent: 'var(--success-color, #22c55e)' },
  error: { icon: '⚠️', accent: 'var(--danger-color, #ef4444)' },
  info: { icon: 'ℹ️', accent: 'var(--accent-color, #6366f1)' },
};

function render(variant, title, description) {
  const { icon, accent } = VARIANTS[variant] ?? VARIANTS.info;
  return toast.custom(
    (t) => (
      <div
        role="status"
        onClick={() => toast.dismiss(t.id)}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          minWidth: '240px',
          maxWidth: '380px',
          padding: '12px 14px',
          background: 'var(--card-bg)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
          borderLeft: `4px solid ${accent}`,
          borderRadius: '12px',
          boxShadow: '0 12px 32px -12px rgba(0,0,0,0.45)',
          cursor: 'pointer',
          opacity: t.visible ? 1 : 0,
          transform: t.visible ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}
      >
        <span style={{ fontSize: '18px', lineHeight: '20px', flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: '14px', lineHeight: '18px' }}>{title}</p>
          {description && (
            <p style={{ marginTop: '2px', fontSize: '12.5px', lineHeight: '17px', color: 'var(--text-secondary)' }}>
              {description}
            </p>
          )}
        </div>
      </div>
    ),
    { duration: variant === 'error' ? 4500 : 2800 },
  );
}

export const notify = {
  success: (title, description) => render('success', title, description),
  error: (title, description) => render('error', title, description),
  info: (title, description) => render('info', title, description),
  dismiss: toast.dismiss,
};

export default notify;

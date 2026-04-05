/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Map to CSS custom properties so dark mode works via [data-theme]
        'bg-primary': 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'card-bg': 'var(--card-bg)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'border-col': 'var(--border-color)',
        'ht-success': 'var(--success-color)',
        'ht-danger': 'var(--danger-color)',
        'ht-accent': 'var(--accent-color)',
      },
      borderRadius: {
        card: '0.75rem',
      },
      boxShadow: {
        card: 'var(--shadow)',
        'card-hover': 'var(--shadow-hover)',
      },
    },
  },
  plugins: [],
};

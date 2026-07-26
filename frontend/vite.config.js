import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Vite inlines import.meta.env.* at BUILD time — string substitution, not a runtime
// lookup. So a production build with VITE_API_URL unset would ship a bundle that can
// never reach the API, and setting the variable afterwards would NOT fix the already
// deployed artifact; only a rebuild would. Failing the build here turns that silent,
// browser-side failure into a loud one in the Vercel build log.
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProductionBuild = command === 'build' && mode !== 'development';

  if (isProductionBuild && !env.VITE_API_URL) {
    throw new Error(
      '\n\n❌ VITE_API_URL is required for a production build.\n' +
      '   Set it to your deployed API base URL, e.g. https://your-api.onrender.com/api\n' +
      '   • Vercel:  Project → Settings → Environment Variables, then REDEPLOY\n' +
      '              (env vars are baked in at build time — adding one without a\n' +
      '               redeploy leaves the old bundle in place)\n' +
      '   • Locally: put it in frontend/.env, or run `vite build --mode development`\n'
    );
  }

  // Warn (don't fail) on the optional integrations — the app works without them,
  // but silently shipping without Google Sign-In is a surprise worth flagging.
  if (isProductionBuild) {
    if (!env.VITE_GOOGLE_CLIENT_ID) {
      console.warn('⚠️  VITE_GOOGLE_CLIENT_ID unset — the Google Sign-In button will NOT render in this build.');
    }
    if (!env.VITE_VAPID_PUBLIC_KEY) {
      console.warn('⚠️  VITE_VAPID_PUBLIC_KEY unset — push reminder settings will be hidden in this build.');
    }
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // Lets client.js fall back to a relative '/api' in dev — no env var needed.
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  };
});

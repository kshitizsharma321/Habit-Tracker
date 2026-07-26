const { createClient } = require('@supabase/supabase-js');

// Bucket name in Supabase Storage
const BACKUP_BUCKET = 'habit-backups';

// Lazy singleton — creating the client eagerly with missing env vars throws at
// require-time and prevents the whole server from booting. Backups are an
// optional feature; the server must run without them.
let client = null;

function getSupabase() {
  if (client) return client;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return client;
}

module.exports = { getSupabase, BACKUP_BUCKET };

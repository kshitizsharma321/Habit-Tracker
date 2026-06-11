/**
 * One-time migration: generate unique usernames for all users who don't have one.
 *
 * Run ONCE before deploying the username auth changes:
 *   cd backend && node scripts/migrate-usernames.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

function sanitize(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 28);
}

async function generateUnique(base) {
  const clean = sanitize(base) || 'user';
  const padded = clean.length < 3 ? clean.padEnd(3, '0') : clean;
  let candidate = padded;
  let n = 0;
  while (await User.findOne({ username: candidate })) {
    n++;
    candidate = `${padded.slice(0, 27)}${n}`;
  }
  return candidate;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const users = await User.find({ $or: [{ username: null }, { username: { $exists: false } }] }).lean();
  console.log(`Found ${users.length} users without a username.\n`);

  for (const u of users) {
    const base = u.name?.trim() ? u.name : u.email.split('@')[0];
    const username = await generateUnique(base);
    await User.updateOne({ _id: u._id }, { $set: { username } });
    console.log(`  ✓  ${u.email}  →  @${username}`);
  }

  console.log('\nMigration complete.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

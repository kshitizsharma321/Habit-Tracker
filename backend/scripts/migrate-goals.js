/**
 * One-time migration: strip the `period` field from all habit definition goals.
 *
 * Background: goal.period (daily/weekly/monthly/yearly) was removed from the app.
 * Goals are now a simple numeric threshold used only for per-entry streak comparison.
 *
 * Safe to run multiple times — the $unset is a no-op if the field is already gone.
 *
 * Run once: cd backend && node scripts/migrate-goals.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;
  const collection = db.collection('habitdefinitions');

  // Count how many have the period field
  const affected = await collection.countDocuments({ 'goal.period': { $exists: true } });
  console.log(`Habit definitions with goal.period: ${affected}`);

  if (affected === 0) {
    console.log('Nothing to migrate.');
    await mongoose.disconnect();
    return;
  }

  const result = await collection.updateMany(
    { 'goal.period': { $exists: true } },
    { $unset: { 'goal.period': '' } }
  );

  console.log(`Migrated: ${result.modifiedCount} documents — goal.period removed.`);
  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

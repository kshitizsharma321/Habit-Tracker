/**
 * One-time script to remove orphaned habit definitions and entries
 * that belong to deleted users.
 *
 * Usage: node _cleanup.js
 * (reads MONGODB_URI from .env in the same directory)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const HabitDefinition = require('../models/HabitDefinition');
const Habit = require('../models/Habit');
const Subscription = require('../models/Subscription');

async function clean() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  const userIds = (await User.find({}, '_id').lean()).map((u) => u._id);
  console.log(`Existing users: ${userIds.length}`);

  const orphanDefs = await HabitDefinition.find({ userId: { $nin: userIds } }).lean();
  console.log(`Orphan definitions: ${orphanDefs.length}`);

  const orphanDefIds = orphanDefs.map((d) => d._id);

  const orphanHabits = await Habit.countDocuments({
    $or: [
      { userId: { $nin: userIds } },
      ...(orphanDefIds.length ? [{ habitId: { $in: orphanDefIds } }] : []),
    ],
  });
  console.log(`Orphan entries: ${orphanHabits}`);

  const orphanSubs = await Subscription.countDocuments({ userId: { $nin: userIds } });
  console.log(`Orphan subscriptions: ${orphanSubs}`);

  if (orphanDefs.length === 0 && orphanHabits === 0 && orphanSubs === 0) {
    console.log('Nothing to clean.');
    process.exit(0);
  }

  console.log('\nDeleting...');
  const habitDel = await Habit.deleteMany({
    $or: [
      { userId: { $nin: userIds } },
      ...(orphanDefIds.length ? [{ habitId: { $in: orphanDefIds } }] : []),
    ],
  });
  if (orphanDefIds.length) await HabitDefinition.deleteMany({ _id: { $in: orphanDefIds } });
  const subDel = await Subscription.deleteMany({ userId: { $nin: userIds } });

  console.log(`Deleted ${orphanDefs.length} definitions, ${habitDel.deletedCount} entries, ${subDel.deletedCount} subscriptions.`);
  console.log('Done.');
  process.exit(0);
}

clean().catch((err) => {
  console.error(err);
  process.exit(1);
});

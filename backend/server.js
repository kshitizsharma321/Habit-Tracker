require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Habit = require('./models/Habit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:5173', 'http://localhost:4173'];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch((err) => console.error('❌ MongoDB connection error:', err));

// Routes

// Get all habit data
app.get('/api/habits', async (req, res) => {
  try {
    const habits = await Habit.find().sort({ date: 1 });
    
    // Convert to object format { "2026-01-01": "yes", "2026-01-02": "no" }
    const habitData = {};
    habits.forEach(habit => {
      habitData[habit.date] = habit.response;
    });
    
    res.json(habitData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch habits', message: error.message });
  }
});

// Save or update a habit entry
app.post('/api/habits', async (req, res) => {
  try {
    const { date, response } = req.body;
    
    if (!date || !response) {
      return res.status(400).json({ error: 'Date and response are required' });
    }
    
    if (!['yes', 'no'].includes(response)) {
      return res.status(400).json({ error: 'Response must be "yes" or "no"' });
    }
    
    // Update if exists, create if not
    const habit = await Habit.findOneAndUpdate(
      { date },
      { response },
      { new: true, upsert: true }
    );
    
    res.json({ success: true, habit });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save habit', message: error.message });
  }
});

// Bulk save/update habits (for migration or batch operations)
app.post('/api/habits/bulk', async (req, res) => {
  try {
    const habitData = req.body; // Object with date keys and response values
    
    if (typeof habitData !== 'object') {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    
    const operations = Object.entries(habitData).map(([date, response]) => ({
      updateOne: {
        filter: { date },
        update: { response },
        upsert: true
      }
    }));
    
    if (operations.length > 0) {
      await Habit.bulkWrite(operations);
    }
    
    res.json({ success: true, count: operations.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save habits in bulk', message: error.message });
  }
});

// Delete a habit entry
app.delete('/api/habits/:date', async (req, res) => {
  try {
    const { date } = req.params;
    await Habit.findOneAndDelete({ date });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete habit', message: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

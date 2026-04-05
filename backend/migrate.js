require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Habit = require('./models/Habit');

// Function to parse CSV file
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  
  // Skip header line
  const dataLines = lines.slice(1);
  
  const habitData = {};
  
  dataLines.forEach(line => {
    // Split by comma, handling potential quoted values
    const parts = line.split(',');
    
    if (parts.length >= 2) {
      // Parse date from DD/MM/YYYY format to YYYY-MM-DD
      const dateParts = parts[0].trim().split('/');
      if (dateParts.length === 3) {
        const day = dateParts[0].padStart(2, '0');
        const month = dateParts[1].padStart(2, '0');
        const year = dateParts[2];
        const dateKey = `${year}-${month}-${day}`;
        
        const response = parts[1].trim().toLowerCase();
        
        if (response === 'yes' || response === 'no') {
          habitData[dateKey] = response;
        }
      }
    }
  });
  
  return habitData;
}

// Migration function
async function migrate(csvFilePath) {
  try {
    console.log('🚀 Starting migration...');
    
    // Check if CSV file exists
    if (!fs.existsSync(csvFilePath)) {
      console.error(`❌ CSV file not found: ${csvFilePath}`);
      console.log('\nPlease provide the correct path to your CSV file.');
      console.log('Usage: node migrate.js <path-to-csv-file>');
      process.exit(1);
    }
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
    
    // Parse CSV
    console.log('📄 Reading CSV file...');
    const habitData = parseCSV(csvFilePath);
    const entries = Object.entries(habitData);
    console.log(`📊 Found ${entries.length} habit entries`);
    
    if (entries.length === 0) {
      console.log('⚠️  No valid data found in CSV file');
      await mongoose.connection.close();
      process.exit(0);
    }
    
    // Import to MongoDB
    console.log('💾 Importing to database...');
    let successCount = 0;
    let errorCount = 0;
    
    for (const [date, response] of entries) {
      try {
        await Habit.findOneAndUpdate(
          { date },
          { response },
          { upsert: true, new: true }
        );
        successCount++;
        
        // Show progress
        if (successCount % 10 === 0) {
          process.stdout.write(`\r   Imported: ${successCount}/${entries.length}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`\n⚠️  Error importing ${date}:`, error.message);
      }
    }
    
    console.log(`\n\n✅ Migration complete!`);
    console.log(`   Successfully imported: ${successCount} entries`);
    if (errorCount > 0) {
      console.log(`   Errors: ${errorCount}`);
    }
    
    // Close connection
    await mongoose.connection.close();
    console.log('👋 Database connection closed');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

// Get CSV file path from command line argument
const csvFilePath = process.argv[2];

if (!csvFilePath) {
  console.log('Usage: node migrate.js <path-to-csv-file>');
  console.log('\nExample:');
  console.log('  node migrate.js ../habit-tracker-backup-2026-02-03.csv');
  console.log('  node migrate.js /path/to/your/backup.csv');
  process.exit(1);
}

// Run migration
migrate(csvFilePath);

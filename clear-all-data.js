const fs = require('fs');
const path = require('path');

console.log('🗑️ Clearing all desktop server data...');

// Clear database by recreating it
const dbPath = './inventory.db';
if (fs.existsSync(dbPath)) {
  try {
    fs.unlinkSync(dbPath);
    console.log('✅ Database deleted');
  } catch (error) {
    console.log('⚠️ Database file locked, will be recreated on server start');
  }
}

// Clear images
const imagePaths = [
  './src/electron/product-images',
  './src/electron/invoice-images'
];

imagePaths.forEach(imgPath => {
  if (fs.existsSync(imgPath)) {
    const files = fs.readdirSync(imgPath);
    files.forEach(file => {
      const filePath = path.join(imgPath, file);
      try {
        fs.unlinkSync(filePath);
        console.log(`✅ Deleted: ${file}`);
      } catch (error) {
        console.log(`⚠️ Could not delete: ${file}`);
      }
    });
  }
});

// Clear logs
const logFiles = ['server.log', 'nul'];
logFiles.forEach(logFile => {
  if (fs.existsSync(logFile)) {
    try {
      fs.unlinkSync(logFile);
      console.log(`✅ Deleted: ${logFile}`);
    } catch (error) {
      console.log(`⚠️ Could not delete: ${logFile}`);
    }
  }
});

console.log('✅ Desktop server data clearing completed!');
console.log('🚀 Starting fresh server...');

// Start the server
require('./src/electron/server.js');
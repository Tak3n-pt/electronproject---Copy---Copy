# Claude Code macOS Build Instructions

## Project: CoreLink Desktop
An Electron-based inventory management application with React frontend, SQLite database, and AWS Textract integration.

## CRITICAL: This project was developed on Windows
The native modules (SQLite3) need to be rebuilt for macOS. The provided script handles this automatically.

## Build Instructions

### Step 1: Setup
```bash
# Use the fixed package.json for macOS
cp package-fixed-for-mac.json package.json

# Make the build script executable
chmod +x MACOS-CRITICAL-FIX.sh
```

### Step 2: Run the Critical Fix Script
```bash
# This script will:
# 1. Remove Windows node_modules
# 2. Install fresh dependencies
# 3. Rebuild SQLite3 for macOS
# 4. Build the React app
# 5. Create the DMG installer
./MACOS-CRITICAL-FIX.sh
```

### Expected Output
- A `.dmg` file in the `dist/` folder
- File name: `CoreLink Desktop-1.0.0.dmg`

## If the Build Fails

### Common Issues:

1. **SQLite3 compilation error**
   ```bash
   # Install Xcode command line tools
   xcode-select --install
   ```

2. **Port 4000 already in use**
   ```bash
   # Kill the process using port 4000
   lsof -ti:4000 | xargs kill -9
   ```

3. **Permission denied errors**
   ```bash
   # Fix permissions
   chmod -R 755 .
   ```

4. **Missing Python for node-gyp**
   ```bash
   # Install Python if needed
   brew install python
   ```

## Alternative Build Commands

If the script fails, try these manual steps:

```bash
# Clean everything
rm -rf node_modules package-lock.json dist dist-react

# Fresh install
npm install

# Rebuild native modules
npm rebuild sqlite3 --build-from-source
npx electron-rebuild

# Build React
npm run build

# Build macOS app
npm run dist:mac
```

## Success Indicators
- ✅ "Build process complete!" message
- ✅ DMG file exists in `dist/` folder
- ✅ File size is approximately 100-150 MB

## Testing the App
1. Double-click the DMG file
2. Drag CoreLink to Applications
3. Open from Applications (may need to allow in Security settings)

## Features to Test
- Product management (add/edit/delete)
- Invoice scanning with AWS Textract
- Database operations
- Chart visualizations
- Multi-language support
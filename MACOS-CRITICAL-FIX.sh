#!/bin/bash

# CoreLink Desktop - macOS CRITICAL FIX Script
# This WILL make it work on macOS

set -e

echo "🔧 CRITICAL macOS Fix Script Starting..."
echo "==========================================="

# 1. CRITICAL: Remove Windows node_modules
echo "🗑️  Step 1: Removing Windows node_modules (CRITICAL!)"
rm -rf node_modules
rm -rf package-lock.json

# 2. Clean all build artifacts
echo "🧹 Step 2: Cleaning all build artifacts..."
rm -rf dist dist-react .cache

# 3. Fresh install with native compilation
echo "📦 Step 3: Fresh install with macOS native modules..."
npm install --force

# 4. Rebuild native modules specifically for macOS
echo "🔨 Step 4: Rebuilding native modules for macOS..."
npm rebuild sqlite3 --build-from-source

# 5. Install electron-rebuild and use it
echo "⚡ Step 5: Rebuilding Electron native modules..."
npm install --save-dev electron-rebuild
./node_modules/.bin/electron-rebuild

# 6. Build the React app
echo "⚛️  Step 6: Building React application..."
npm run build

# 7. Verify build output exists
if [ ! -f "dist-react/index.html" ]; then
    echo "❌ React build failed - no index.html found!"
    exit 1
fi

# 8. Build macOS app WITHOUT specifying architecture
echo "🍎 Step 7: Building macOS application..."
npx electron-builder --mac --config

# 9. Check results
echo ""
echo "✅ Build process complete!"
echo "==========================================="

if [ -f "dist/"*.dmg ]; then
    echo "🎉 SUCCESS! DMG file created:"
    ls -la dist/*.dmg
else
    echo "⚠️  No DMG found. Check dist folder:"
    ls -la dist/
fi
#!/bin/bash

# CoreLink Desktop - macOS Build Script (FIXED)
# This script builds a working macOS app

set -e

echo "🚀 Building CoreLink Desktop for macOS (Fixed Version)..."

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "⚠️  Warning: Building on non-macOS system. Some features may not work."
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist dist-react node_modules/.cache

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Build the React app
echo "⚛️  Building React application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ React build failed!"
    exit 1
fi

# Check if build output exists
if [ ! -f "dist-react/index.html" ]; then
    echo "❌ React build output not found!"
    exit 1
fi

# Build the macOS app (without specifying icon)
echo "🍎 Building macOS application..."
NODE_ENV=production npm run dist:mac

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ macOS build completed successfully!"
    echo "📁 Check the 'dist' folder for your .dmg file"
    echo ""
    echo "🎉 Your CoreLink Desktop app is ready for distribution!"
    echo ""
    ls -la dist/*.dmg 2>/dev/null || echo "No .dmg files found in dist/"
else
    echo "❌ macOS build failed!"
    echo "Check the error messages above for details."
    exit 1
fi
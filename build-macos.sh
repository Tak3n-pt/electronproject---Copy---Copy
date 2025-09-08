#!/bin/bash

# CoreLink Desktop - macOS Build Script
# This script builds a production-ready macOS installer

echo "🚀 Building CoreLink Desktop for macOS..."

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "⚠️  This script should be run on macOS for best results"
    echo "   You can still build, but code signing won't work"
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
npm run clean

# Create icon if it doesn't exist
if [ ! -f "build/icon.icns" ]; then
    echo "⚠️  No icon.icns found. Creating placeholder..."
    if command -v sips &> /dev/null; then
        # Convert SVG to PNG first, then to ICNS (requires macOS)
        echo "Converting icon.svg to icon.icns..."
        # This would need manual conversion or additional tools
        echo "Please convert build/icon.svg to build/icon.icns manually"
    else
        echo "Please create build/icon.icns for the final build"
    fi
fi

# Build the React app
echo "⚛️  Building React application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ React build failed!"
    exit 1
fi

# Build the macOS app
echo "🍎 Building macOS application..."
npm run dist:mac

if [ $? -eq 0 ]; then
    echo "✅ macOS build completed successfully!"
    echo "📁 Check the 'dist' folder for your .dmg file"
    echo ""
    echo "🎉 Your CoreLink Desktop app is ready for distribution!"
    echo "   The .dmg file can be shared with users for installation"
else
    echo "❌ macOS build failed!"
    exit 1
fi
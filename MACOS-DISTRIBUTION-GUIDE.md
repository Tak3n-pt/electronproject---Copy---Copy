# CoreLink Desktop - macOS Distribution Guide

## 🚀 Ready for Distribution

Your CoreLink Desktop app is configured and ready to be distributed to macOS users!

## 📋 Prerequisites for Building

### On macOS (Recommended):
```bash
# 1. Install Node.js (if not already installed)
brew install node

# 2. Navigate to your app directory
cd "eletcron desk app"

# 3. Install dependencies
npm install

# 4. Run the build script
chmod +x build-macos.sh
./build-macos.sh
```

### Cross-Platform Build (Alternative):
If you don't have a Mac, you can use GitHub Actions or cloud services.

## 🎨 Icon Setup (Required)

1. **Convert the SVG icon to ICNS**:
   - Upload `build/icon.svg` to https://convertio.co/svg-icns/
   - Download the converted `.icns` file
   - Save it as `build/icon.icns`

2. **Or use command line (macOS only)**:
   ```bash
   # Convert SVG to PNG first (1024x1024)
   # Then convert to ICNS
   sips -s format icns build/icon.png --out build/icon.icns
   ```

## 🔨 Manual Build Process

```bash
# 1. Clean and install
npm run clean
npm install

# 2. Build React app
npm run build

# 3. Build macOS installer
npm run dist:mac
```

## 📦 What You'll Get

After building, you'll find in the `dist` folder:
- **CoreLink Desktop.dmg** - Installer for users
- **mac** folder with the app bundle

## 🎯 Distribution to Users

### For End Users (Installation Instructions):

1. **Download** the `.dmg` file
2. **Double-click** the `.dmg` file to mount it
3. **Drag** CoreLink Desktop to the Applications folder
4. **Open** Applications and double-click CoreLink Desktop
5. **Allow** the app if macOS shows security warnings:
   - Go to System Preferences → Security & Privacy
   - Click "Open Anyway" for CoreLink Desktop

### Security Note:
Since the app isn't code-signed with an Apple Developer certificate, users will see a security warning. For production distribution, you should:
- Get an Apple Developer account ($99/year)
- Code sign your app
- Optionally notarize it with Apple

## 🔧 App Features Ready for Users:

✅ **Inventory Management** - Add, edit, delete products  
✅ **AWS Textract Integration** - Process invoices  
✅ **SQLite Database** - Local data storage  
✅ **Modern UI** - React-based interface  
✅ **Desktop Integration** - Native window controls  
✅ **Cross-platform** - Works on macOS, Windows, Linux  

## 📱 System Requirements:

- **macOS**: 10.14 (Mojave) or later
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 200MB for installation
- **Internet**: Required for AWS Textract features

## 🚨 Troubleshooting:

**Build fails?**
- Ensure Node.js 16+ is installed
- Run `npm install` to update dependencies
- Check that build/icon.icns exists

**Users can't open the app?**
- Guide them through macOS security settings
- They need to right-click → "Open" the first time

## 🎉 Ready to Ship!

Your CoreLink Desktop app is production-ready for macOS distribution!
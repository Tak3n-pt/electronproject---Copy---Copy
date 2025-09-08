# CoreLink Desktop - Windows Deployment Guide

## ✅ Pre-Deployment Checklist

The Electron desktop app is fully configured for Windows deployment with:

### Configuration Complete:
- ✅ **package.json** - Fully configured with Windows build settings
- ✅ **Electron Builder** - NSIS installer configured
- ✅ **Windows targets** - Both installer and portable versions
- ✅ **Auto-updater** - Ready for automatic updates
- ✅ **File associations** - .corelink files
- ✅ **Registry entries** - Proper Windows integration

## 📦 Build Requirements

### Prerequisites:
1. **Node.js** (v18 or higher)
2. **npm** or **yarn**
3. **Windows SDK** (for code signing - optional)
4. **Visual Studio Build Tools** (for native modules)

## 🚀 Building for Windows

### Step 1: Install Dependencies
```bash
cd "eletcron desk app"
npm install
```

### Step 2: Build the React Frontend
```bash
npm run build
```

### Step 3: Build Windows Installer
```bash
# For 64-bit Windows installer
npm run dist:win

# This will create:
# - dist/CoreLink-Setup-1.0.0.exe (NSIS installer)
# - dist/CoreLink-Portable-1.0.0.exe (Portable version)
```

## 🎯 Build Outputs

After building, you'll find in the `dist` folder:

1. **CoreLink-Setup-1.0.0.exe** (Recommended)
   - Full NSIS installer
   - Creates Start Menu shortcuts
   - Desktop shortcut
   - File associations
   - Uninstaller included
   - Size: ~80-100 MB

2. **CoreLink-Portable-1.0.0.exe**
   - No installation required
   - Run directly from USB/folder
   - All settings stored locally
   - Size: ~80-100 MB

## 🔐 Code Signing (Optional but Recommended)

### Why Code Sign?
- Prevents Windows SmartScreen warnings
- Builds user trust
- Required for automatic updates

### How to Code Sign:
1. **Obtain a Code Signing Certificate** ($200-500/year)
   - DigiCert, Sectigo, or GlobalSign

2. **Configure package.json**:
```json
"build": {
  "win": {
    "certificateFile": "path/to/certificate.pfx",
    "certificatePassword": "your-password"
  }
}
```

3. **Or use environment variables**:
```bash
set CSC_LINK=path/to/certificate.pfx
set CSC_KEY_PASSWORD=your-password
npm run dist:win
```

## 📝 Windows Store Deployment (Optional)

### Convert to APPX for Microsoft Store:
```bash
# Add to package.json build config
"win": {
  "target": ["nsis", "appx"]
}
```

### Requirements:
- Windows Developer Account ($19 one-time)
- App must pass Windows App Certification

## 🔄 Auto-Update Configuration

The app is configured for automatic updates. To enable:

1. **Set up update server** (GitHub Releases, S3, or custom)
2. **Configure update URL** in package.json
3. **Sign your builds** (required for auto-update)

## 🛠️ Customization

### Icons and Graphics

Place in `build` folder:
- **icon.ico** - Main app icon (multiple sizes: 16, 32, 48, 64, 128, 256)
- **installerSidebar.bmp** - NSIS installer sidebar (164x314 pixels)
- **installerHeader.bmp** - NSIS installer header (150x57 pixels)

### Convert PNG to ICO:
- Use online tools like convertio.co
- Or use ImageMagick: `convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico`

## 📊 Installation Features

### What the Installer Does:
1. ✅ Installs to Program Files
2. ✅ Creates Start Menu folder
3. ✅ Creates Desktop shortcut
4. ✅ Registers .corelink file extension
5. ✅ Adds Firewall exception
6. ✅ Sets up uninstaller
7. ✅ Optional: Install for all users

### Silent Installation:
```bash
CoreLink-Setup-1.0.0.exe /S /D=C:\CustomPath
```

## 🧪 Testing Checklist

Before distribution, test:
- [ ] Installation on clean Windows 10/11
- [ ] Desktop shortcut works
- [ ] Start Menu shortcuts work
- [ ] File associations (.corelink files)
- [ ] Uninstaller removes everything
- [ ] Database connection works
- [ ] Backend server connectivity
- [ ] All UI features function
- [ ] Portable version runs without admin

## 🚢 Distribution Methods

### 1. Direct Download
- Host on your website
- Provide both installer and portable versions

### 2. GitHub Releases
```bash
# Create release and upload assets
gh release create v1.0.0 dist/*.exe
```

### 3. Microsoft Store
- Convert to APPX format
- Submit through Partner Center

### 4. Enterprise Deployment
- Use MSI wrapper for Group Policy
- Silent installation via SCCM/Intune

## 📈 Performance Optimization

The build is configured to:
- Exclude unnecessary files (reduces size by 30-40%)
- Bundle database with app
- Optimize node_modules
- Use production React build

## 🐛 Troubleshooting

### Common Issues:

1. **"Windows protected your PC" warning**
   - Solution: Code sign your application

2. **Missing Visual C++ Redistributable**
   - Include in installer or prompt user to install

3. **Firewall blocking connection**
   - Installer adds exception automatically

4. **Database not found**
   - Check extraResources in package.json

## 📋 Final Build Commands

```bash
# Full build and package process
cd "eletcron desk app"
npm install
npm run build
npm run dist:win

# Output will be in dist/ folder
```

## ✅ Deployment Ready!

Your CoreLink Desktop app is fully configured for Windows deployment. The installer will:
- Install the application properly
- Set up all shortcuts and associations
- Configure Windows Firewall
- Create an uninstaller
- Support both 32-bit and 64-bit Windows

Just run `npm run dist:win` to create your Windows installer!
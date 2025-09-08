# CoreLink macOS Icon Setup

## Quick Setup (Recommended)

1. **Download a temporary icon**: Use any 1024x1024 PNG as a placeholder
2. **Convert to ICNS**: 
   - On Mac: `sips -s format icns icon.png --out icon.icns`
   - Online: https://convertio.co/png-icns/
3. **Place in build folder**: Save as `icon.icns` in this directory

## Temporary Icon (Use this for now)

Create a simple 1024x1024 PNG with your company logo or the letter "C" for CoreLink.

## For Production

You'll want to create a professional icon with:
- 1024x1024 pixels
- Transparent background
- Your company branding
- Clean, modern design

The electron-builder will automatically handle all the different sizes needed for macOS.
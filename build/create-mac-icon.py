#!/usr/bin/env python3
"""
Create a macOS icon (.icns) file for CoreLink Desktop
This script creates a simple icon that can be used for the application.
"""

import os
from PIL import Image, ImageDraw, ImageFont

def create_icon():
    # Create a 1024x1024 base image
    size = 1024
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Create a modern app icon design
    # Background circle
    center = size // 2
    radius = int(size * 0.45)
    
    # Gradient-like background (simplified)
    draw.ellipse([center - radius, center - radius, center + radius, center + radius], 
                 fill=(41, 128, 185, 255))  # Blue background
    
    # Inner circle for contrast
    inner_radius = int(radius * 0.8)
    draw.ellipse([center - inner_radius, center - inner_radius, 
                  center + inner_radius, center + inner_radius], 
                 fill=(52, 152, 219, 255))  # Lighter blue
    
    # Add "C" for CoreLink
    try:
        # Try to use a system font
        font = ImageFont.truetype("arial.ttf", int(size * 0.4))
    except:
        # Fallback to default font
        font = ImageFont.load_default()
    
    # Draw the "C" letter
    text = "C"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    text_x = center - text_width // 2
    text_y = center - text_height // 2
    
    draw.text((text_x, text_y), text, fill=(255, 255, 255, 255), font=font)
    
    return img

def save_icon_sizes(base_img):
    """Save different sizes needed for macOS"""
    sizes = [16, 32, 64, 128, 256, 512, 1024]
    build_dir = os.path.dirname(os.path.abspath(__file__))
    
    for size in sizes:
        resized = base_img.resize((size, size), Image.Resampling.LANCZOS)
        filename = f"icon_{size}x{size}.png"
        resized.save(os.path.join(build_dir, filename))
        print(f"Created {filename}")
    
    # Save the main icon as well
    base_img.save(os.path.join(build_dir, "icon.png"))
    print("Created icon.png")

if __name__ == "__main__":
    print("Creating CoreLink macOS icon...")
    icon = create_icon()
    save_icon_sizes(icon)
    print("\nIcon files created! Use an online converter or macOS to create the .icns file:")
    print("1. Go to https://convertio.co/png-icns/")
    print("2. Upload icon.png")
    print("3. Download the .icns file")
    print("4. Place it in the build directory as 'icon.icns'")
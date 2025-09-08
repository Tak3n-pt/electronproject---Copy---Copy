@echo off
echo ========================================
echo     CoreLink Desktop - Windows Builder
echo ========================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/5] Checking Node.js version...
node --version

:: Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed
    pause
    exit /b 1
)

echo [2/5] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [3/5] Building React frontend...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build React frontend
    pause
    exit /b 1
)

echo.
echo [4/5] Creating Windows installers...
echo This may take several minutes...
call npm run dist:win
if %errorlevel% neq 0 (
    echo [ERROR] Failed to create Windows installer
    pause
    exit /b 1
)

echo.
echo [5/5] Build complete!
echo.
echo ========================================
echo     BUILD SUCCESSFUL!
echo ========================================
echo.
echo Your Windows installers are ready in the 'dist' folder:
echo.
dir dist\*.exe /b 2>nul
echo.
echo 1. CoreLink-Setup-*.exe    - Full installer with shortcuts
echo 2. CoreLink-Portable-*.exe - Portable version (no install)
echo.
echo You can now distribute these files to users!
echo.
pause
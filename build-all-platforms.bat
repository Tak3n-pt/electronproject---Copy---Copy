@echo off
echo ========================================
echo   CoreLink Desktop - Multi-Platform Builder
echo ========================================
echo.

:: Check requirements
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed
    pause
    exit /b 1
)

echo Select build target:
echo.
echo [1] Windows Only (x64 + x86)
echo [2] Windows Portable Only
echo [3] Windows All (Installer + Portable)
echo [4] Clean Build (Delete old builds first)
echo [5] Development Build (Unpackaged)
echo.
set /p choice="Enter your choice (1-5): "

:: Install dependencies if needed
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)

:: Build React frontend
echo Building React frontend...
call npm run build

:: Handle user choice
if "%choice%"=="1" (
    echo Building Windows Installer...
    call npm run dist:win
    goto :success
)

if "%choice%"=="2" (
    echo Building Windows Portable...
    call npx electron-builder --win portable
    goto :success
)

if "%choice%"=="3" (
    echo Building all Windows targets...
    call npm run dist:win
    goto :success
)

if "%choice%"=="4" (
    echo Cleaning old builds...
    if exist dist rmdir /s /q dist
    echo Building Windows Installer...
    call npm run dist:win
    goto :success
)

if "%choice%"=="5" (
    echo Creating development build...
    call npx electron-builder --win --dir
    goto :success
)

echo Invalid choice!
pause
exit /b 1

:success
echo.
echo ========================================
echo     BUILD COMPLETE!
echo ========================================
echo.
echo Check the 'dist' folder for output files
echo.
pause
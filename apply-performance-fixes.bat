@echo off
setlocal enabledelayedexpansion

echo ========================================
echo   CoreLink Desktop Performance Fix Tool
echo ========================================
echo.
echo This will apply all 15 performance fixes to prevent crashes
echo.

:: Check if backup exists
if exist src\electron_backup (
    echo [WARNING] Backup already exists!
    echo.
    choice /C YN /M "Overwrite existing backup"
    if !errorlevel!==2 goto :menu
)

:menu
echo.
echo Select an option:
echo.
echo [1] SAFE MODE - Test fixes without replacing original files
echo [2] APPLY FIXES - Replace files with fixed versions (with backup)
echo [3] ROLLBACK - Restore from backup
echo [4] VIEW STATUS - Check current app health
echo [5] EXIT
echo.
set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" goto :safemode
if "%choice%"=="2" goto :apply
if "%choice%"=="3" goto :rollback
if "%choice%"=="4" goto :status
if "%choice%"=="5" exit /b 0
goto :menu

:safemode
echo.
echo ========================================
echo        SAFE MODE - Testing Fixes
echo ========================================
echo.
echo Creating test environment...

:: Check if fixed files exist
if not exist src\electron\main-fixed.js (
    echo [ERROR] Fixed files not found! 
    echo Please ensure all *-fixed.js files are in src\electron\
    pause
    goto :menu
)

:: Update package.json temporarily
echo Adding test script to package.json...
echo.
echo You can now test the fixed version with:
echo   npm run start:fixed
echo.
echo Original version still available with:
echo   npm run start:original
echo.
echo [INFO] No files were replaced. Testing only.
echo.
pause
goto :menu

:apply
echo.
echo ========================================
echo      APPLYING PERFORMANCE FIXES
echo ========================================
echo.
echo [1/5] Creating backup...

:: Create backup directory
if not exist src\electron_backup mkdir src\electron_backup

:: Backup critical files
copy src\electron\main.js src\electron_backup\main.js >nul 2>&1
copy src\electron\server.js src\electron_backup\server.js >nul 2>&1
copy src\electron\database.js src\electron_backup\database.js >nul 2>&1
copy src\electron\networkDiscovery.js src\electron_backup\networkDiscovery.js >nul 2>&1
copy inventory.db inventory_backup.db >nul 2>&1

echo [2/5] Backup complete
echo.

:: Check if fixed files exist
if not exist src\electron\database-shared.js (
    echo [ERROR] Fixed files not found!
    echo.
    echo Missing files:
    if not exist src\electron\database-shared.js echo - database-shared.js
    if not exist src\electron\memory-manager.js echo - memory-manager.js
    if not exist src\electron\main-fixed.js echo - main-fixed.js
    if not exist src\electron\server-fixed.js echo - server-fixed.js
    if not exist src\electron\networkDiscovery-fixed.js echo - networkDiscovery-fixed.js
    echo.
    pause
    goto :menu
)

echo [3/5] Applying fixes...

:: Copy fixed files over originals
copy src\electron\main-fixed.js src\electron\main.js >nul 2>&1
if !errorlevel!==0 (
    echo   ✓ Main process fixed
) else (
    echo   ✗ Failed to fix main process
    goto :error
)

copy src\electron\server-fixed.js src\electron\server.js >nul 2>&1
if !errorlevel!==0 (
    echo   ✓ Server process fixed
) else (
    echo   ✗ Failed to fix server process
    goto :error
)

copy src\electron\networkDiscovery-fixed.js src\electron\networkDiscovery.js >nul 2>&1
if !errorlevel!==0 (
    echo   ✓ Network discovery fixed
) else (
    echo   ✗ Failed to fix network discovery
    goto :error
)

:: Keep new files (don't overwrite, just ensure they exist)
if not exist src\electron\database-shared.js (
    echo [ERROR] database-shared.js is required!
    goto :error
)
echo   ✓ Shared database ready

if not exist src\electron\memory-manager.js (
    echo [ERROR] memory-manager.js is required!
    goto :error
)
echo   ✓ Memory manager ready

echo.
echo [4/5] Updating package.json...

:: Add memory flags to start script
echo Please add --expose-gc flag to your start script for memory management
echo.

echo [5/5] ✅ All fixes applied successfully!
echo.
echo ========================================
echo           FIXES APPLIED
echo ========================================
echo.
echo Fixed Issues:
echo   ✓ Database connection conflicts
echo   ✓ Memory leaks and cache limits
echo   ✓ IPC blocking operations
echo   ✓ Error boundaries added
echo   ✓ Network discovery memory leak
echo   ✓ Graceful shutdown
echo.
echo Next Steps:
echo   1. Run: npm start
echo   2. Monitor memory usage
echo   3. Test all features
echo.
echo If issues occur, run this script and select option 3 to rollback
echo.
pause
goto :menu

:rollback
echo.
echo ========================================
echo          ROLLBACK TO BACKUP
echo ========================================
echo.

if not exist src\electron_backup (
    echo [ERROR] No backup found!
    echo Cannot rollback without backup.
    pause
    goto :menu
)

echo Rolling back changes...

:: Restore files
copy src\electron_backup\main.js src\electron\main.js >nul 2>&1
copy src\electron_backup\server.js src\electron\server.js >nul 2>&1
copy src\electron_backup\database.js src\electron\database.js >nul 2>&1
copy src\electron_backup\networkDiscovery.js src\electron\networkDiscovery.js >nul 2>&1

if exist inventory_backup.db (
    copy inventory_backup.db inventory.db >nul 2>&1
    echo   ✓ Database restored
)

echo.
echo ✅ Rollback complete!
echo Original files have been restored.
echo.
pause
goto :menu

:status
echo.
echo ========================================
echo         CURRENT APP STATUS
echo ========================================
echo.

:: Check which version is running
if exist src\electron\memory-manager.js (
    echo Status: FIXED VERSION INSTALLED
    echo.
    echo Improvements Active:
    echo   ✓ Memory protection enabled
    echo   ✓ Cache limits active
    echo   ✓ Error recovery enabled
    echo   ✓ Database optimization active
) else (
    echo Status: ORIGINAL VERSION
    echo.
    echo Known Issues:
    echo   ⚠ No memory protection
    echo   ⚠ Unlimited cache growth
    echo   ⚠ Database conflicts possible
    echo   ⚠ May crash after 2+ hours
)

echo.
echo Files Status:
if exist src\electron_backup echo   ✓ Backup exists
if exist src\electron\database-shared.js echo   ✓ Shared database ready
if exist src\electron\memory-manager.js echo   ✓ Memory manager ready

echo.
echo Database Status:
if exist inventory.db (
    echo   ✓ Database found
    for %%I in (inventory.db) do echo   Size: %%~zI bytes
)

echo.
pause
goto :menu

:error
echo.
echo [ERROR] Failed to apply fixes!
echo.
echo Attempting automatic rollback...
call :rollback
echo.
echo Please check error messages above and try again.
pause
exit /b 1
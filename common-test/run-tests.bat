@echo off
rem Run common tests v3 against a mini-react implementation (based on the updated run-tests.bat)
rem   run-tests.bat                          ask folder (Enter = Desktop\mini-react or mini-react_powershell) and mode
rem   run-tests.bat "C:\...\mini-react" 1    all tests (56 feature + 14 judge + 8 inspection accuracy)
rem   run-tests.bat "C:\...\mini-react" 2    inspection accuracy only (14 judge + 8 inspection)
setlocal
set "SCRIPT_DIR=%~dp0"

set "PROJECT_DIR=%~1"
if defined PROJECT_DIR goto :have_project
echo Enter the mini-react project folder path.
echo Press Enter alone to use Desktop\mini-react or Desktop\mini-react_powershell.
set /p "PROJECT_DIR=Folder: "
:have_project
if not defined PROJECT_DIR goto :ask_mode
set "PROJECT_DIR=%PROJECT_DIR:"=%"

:ask_mode
set "MODE=%~2"
if defined MODE goto :start
echo.
echo Select tests:
echo   1. All tests (56 feature + 14 judge + 8 inspection accuracy)
echo   2. Inspection accuracy only (14 judge + 8 inspection)
set /p "MODE=Enter 1 or 2 (Enter = 1): "
if not defined MODE set "MODE=1"

:start
rem switch to UTF-8 only after the prompts (set /p does not read input under chcp 65001)
chcp 65001 >nul
echo.
if defined PROJECT_DIR goto :start_with_project
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%run-tests.ps1" -Mode "%MODE%"
goto :done
:start_with_project
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%run-tests.ps1" -ProjectFolder "%PROJECT_DIR%" -Mode "%MODE%"

:done
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" echo Tests returned exit code %RESULT%.
pause
exit /b %RESULT%

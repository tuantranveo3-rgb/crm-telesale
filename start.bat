@echo off
echo ====================================
echo   CRM System - Khoi dong ung dung
echo ====================================
echo.
echo [1/2] Khoi dong Backend (port 5000)...
start "CRM Backend" cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 3 /nobreak >nul

echo [2/2] Khoi dong Frontend (port 5173)...
start "CRM Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ====================================
echo  Backend:  http://localhost:5000
echo  Frontend: http://localhost:5173
echo ====================================
echo.
timeout /t 5 /nobreak >nul
start http://localhost:5173

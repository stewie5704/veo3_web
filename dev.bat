@echo off
chcp 65001 >nul
cd /d "%~dp0"
title VEO3 Web - dev launcher

echo ============================================
echo   VEO3 Web - khoi dong moi truong DEV
echo   Backend  : http://localhost:8000
echo   Frontend : http://localhost:5173
echo ============================================

REM Backend (cua so rieng, co log + auto-reload)
start "VEO3 API"  cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --reload --port 8000"

REM Frontend (cua so rieng, Vite dev)
start "VEO3 Web"  cmd /k "cd /d %~dp0frontend && npm run dev"

REM Cho vai giay roi mo trinh duyet
timeout /t 5 >nul
start "" http://localhost:5173

echo.
echo Da mo 2 cua so log (API + Web) + trinh duyet.
echo Dong 2 cua so do de tat server.
echo.
echo Lan dau / khi bi 402 "Can nang goi":
echo     cd backend ^&^& python dev_grant.py EMAIL_CUA_BAN
echo (sau do F5 lai web)

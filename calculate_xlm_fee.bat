@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   TyFi Mainnet Deployment - Comprehensive Fee Calculator
echo ========================================================
echo.
echo Calculating precise resource fees for all 3 smart contracts...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0calculate_xlm_fee.ps1"

echo.
pause

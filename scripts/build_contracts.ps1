# PowerShell script to build Soroban WASM artifacts
$ErrorActionPreference = "Stop"

Write-Host "=== Building Soroban Smart Contracts ===" -ForegroundColor Cyan
Push-Location "$PSScriptRoot\..\contracts"

try {
    Write-Host "1. Building typhoon_resilience_vault..." -ForegroundColor Yellow
    cargo build --target wasm32-unknown-unknown --release -p typhoon_resilience_vault

    Write-Host "2. Building smart_wallet_factory..." -ForegroundColor Yellow
    cargo build --target wasm32-unknown-unknown --release -p smart_wallet_factory

    Write-Host "3. Building tyfi_dao..." -ForegroundColor Yellow
    cargo build --target wasm32-unknown-unknown --release -p tyfi_dao

    Write-Host "=== All contracts compiled to WASM successfully ===" -ForegroundColor Green
} finally {
    Pop-Location
}

# POWERFLOW - Local development runner
# Run from the repository root: .\start_local.ps1
# Requirements: Python 3.12+, Node.js 18+

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  POWERFLOW - Local Dev Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Install Python deps ---
Write-Host "[1/4] Checking Python dependencies..." -ForegroundColor Yellow
Push-Location "$Root\backend"
pip install -q -r requirements_dev.txt
if ($LASTEXITCODE -ne 0) { Write-Error "pip install failed"; exit 1 }
Pop-Location
Write-Host "      OK" -ForegroundColor Green

# --- 2. Install Frontend deps ---
Write-Host "[2/4] Checking Node.js dependencies..." -ForegroundColor Yellow
Push-Location "$Root\frontend"
if (-not (Test-Path "node_modules")) {
    npm install --silent
    if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed"; exit 1 }
}
Pop-Location
Write-Host "      OK" -ForegroundColor Green

# --- 3. Seed demo users (runs once - idempotent) ---
Write-Host "[3/4] Seeding demo users..." -ForegroundColor Yellow
Push-Location "$Root\backend"
$env:DEV_MODE = "true"
$env:PYTHONIOENCODING = "utf-8"
python -m simulator.seed_demo --seed-only
Pop-Location
Write-Host "      OK" -ForegroundColor Green

# --- 4. Start all services in separate windows ---
Write-Host "[4/4] Starting services..." -ForegroundColor Yellow
Write-Host ""

# Backend (FastAPI + uvicorn, hot-reload enabled)
$backendCmd = "cd '$Root\backend'; `$env:DEV_MODE='true'; `$env:PYTHONIOENCODING='utf-8'; uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd -WindowStyle Normal

Start-Sleep -Seconds 2

# Simulator (generates meter readings every 15s by default)
$simCmd = "cd '$Root\backend'; `$env:DEV_MODE='true'; `$env:BACKEND_URL='http://localhost:8000'; `$env:PYTHONIOENCODING='utf-8'; python -m simulator.meter_simulator"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $simCmd -WindowStyle Normal

Start-Sleep -Seconds 1

# Frontend (Next.js dev server - clears stale cache first)
$frontendCmd = "cd '$Root\frontend'; Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd -WindowStyle Normal

Start-Sleep -Seconds 1

# Blockchain (Local Hardhat EVM Node)
$blockchainCmd = "cd '$Root\blockchain'; npx hardhat node"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $blockchainCmd -WindowStyle Normal

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  All services started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:    http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Login:       http://localhost:3000/login" -ForegroundColor Cyan
Write-Host "  API Docs:    http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "  Blockchain:  http://127.0.0.1:8545 (EVM RPC)" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Demo accounts (password: demo):" -ForegroundColor White
Write-Host "    Buyer:     demo_consumer_01" -ForegroundColor Gray
Write-Host "    Seller:    demo_prosumer_01" -ForegroundColor Gray
Write-Host "    DISCOM:    demo_operator" -ForegroundColor Gray
Write-Host ""
Write-Host "  To run the 4-step demo scenario:" -ForegroundColor White
Write-Host '    cd backend; $env:DEV_MODE="true"; python -m simulator.seed_demo' -ForegroundColor Gray
Write-Host ""
Write-Host "  Close the terminal windows to stop." -ForegroundColor DarkGray

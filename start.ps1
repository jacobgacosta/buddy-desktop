#Requires -Version 5
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

function Write-Step  { param($msg) Write-Host "  $msg" -ForegroundColor Cyan }
function Write-OK    { param($msg) Write-Host "    OK  $msg" -ForegroundColor Green }
function Write-Skip  { param($msg) Write-Host "    --  $msg" -ForegroundColor DarkGray }
function Write-Doing { param($msg) Write-Host "    >>  $msg" -ForegroundColor Yellow }
function Write-Fail  { param($msg) Write-Host "    !!  $msg" -ForegroundColor Red }

Clear-Host
Write-Host ""
Write-Host "  Buddy" -ForegroundColor Magenta -NoNewline
Write-Host " — starting up..." -ForegroundColor White
Write-Host ""

# ─────────────────────────────────────────────
# 1. DOCKER
# ─────────────────────────────────────────────
Write-Step "Checking Docker..."
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -ne 0) { throw "docker info failed" }
    Write-OK "Docker is running"
} catch {
    Write-Fail "Docker is not running. Please start Docker Desktop and try again."
    Read-Host "Press Enter to exit"
    exit 1
}

# ─────────────────────────────────────────────
# 2. WHISPER (STT)
# ─────────────────────────────────────────────
Write-Step "Whisper STT (port 8080)..."
$whisperRunning = (docker inspect -f '{{.State.Running}}' local-stt-server 2>$null) -eq "true"
if ($whisperRunning) {
    Write-Skip "local-stt-server already running"
} else {
    $whisperExists = (docker inspect local-stt-server 2>$null) -ne $null
    if ($whisperExists) {
        docker start local-stt-server | Out-Null
        Write-OK "local-stt-server started"
    } else {
        Write-Doing "Creating Whisper container (downloading ~6GB model on first use)..."
        docker run -d --name local-stt-server `
            --gpus all `
            -p 8080:8000 `
            -e MODEL="Systran/faster-whisper-large-v3" `
            -e ALLOW_DOWNLOADS=true `
            --restart unless-stopped `
            -v "$env:USERPROFILE\.cache\huggingface:/root/.cache/huggingface" `
            fedirz/faster-whisper-server:latest-cuda | Out-Null
        Write-OK "local-stt-server created and started"
    }
}

# ─────────────────────────────────────────────
# 3. PIPER (TTS)
# ─────────────────────────────────────────────
Write-Step "Piper TTS (port 5200)..."
$piperRunning = (docker inspect -f '{{.State.Running}}' buddy-piper 2>$null) -eq "true"
if ($piperRunning) {
    Write-Skip "buddy-piper already running"
} else {
    $piperExists = (docker inspect buddy-piper 2>$null) -ne $null
    if ($piperExists) {
        docker start buddy-piper | Out-Null
        Write-OK "buddy-piper started"
    } else {
        Write-Doing "Building Piper image (first time, ~2 min)..."
        docker build -t buddy-piper "$Root\piper-server" | Out-Null
        docker run -d --name buddy-piper `
            -p 5200:5000 `
            --restart unless-stopped `
            buddy-piper | Out-Null
        Write-OK "buddy-piper created and started"
    }
}

# ─────────────────────────────────────────────
# 4. BUDDY SERVER
# ─────────────────────────────────────────────
Write-Step "Buddy server (port 7788)..."

$releaseExe = "$Root\server\target\release\buddy-server.exe"
if (-not (Test-Path $releaseExe)) {
    Write-Doing "Building server (first time, ~3 min)..."
    Push-Location "$Root\server"
    $buildOut = cargo build --release 2>&1
    Pop-Location
    $buildErrors = $buildOut | Where-Object { $_ -match "^error" }
    if ($buildErrors) { $buildErrors | ForEach-Object { Write-Fail $_ } }
    if (-not (Test-Path $releaseExe)) {
        Write-Fail "Server build failed. Make sure Rust is installed: https://rustup.rs"
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-OK "Server built"
}

# Kill any previous instance and free the port
taskkill /F /IM "buddy-server.exe" 2>$null | Out-Null; $LASTEXITCODE = 0
$portOwner = (Get-NetTCPConnection -LocalPort 7788 -ErrorAction SilentlyContinue).OwningProcess | Select-Object -First 1
if ($portOwner) { Stop-Process -Id $portOwner -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 300

Start-Process -FilePath $releaseExe -WorkingDirectory "$Root\server" -WindowStyle Hidden

# Wait until buddy-server is accepting connections (up to 8s)
$ready = $false
for ($i = 0; $i -lt 16; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", 7788)
        $tcp.Close()
        $ready = $true
        break
    } catch {}
}
if ($ready) { Write-OK "buddy-server ready on :7788" }
else        { Write-Fail "buddy-server did not respond after 8s — check $releaseExe"; exit 1 }

# ─────────────────────────────────────────────
# 5. DESKTOP APP
# ─────────────────────────────────────────────
Write-Step "Buddy desktop app..."

$releaseDesktop = "$Root\apps\desktop\src-tauri\target\release\buddy-desktop.exe"
if (-not (Test-Path $releaseDesktop)) {
    Write-Doing "Building app (first time, ~5 min)..."
    Push-Location "$Root\apps\desktop"
    # build:exe uses 'tauri build --no-bundle': compiles the exe without creating an installer.
    # This avoids failures when wix/nsis are not installed.
    $buildOut = pnpm build:exe 2>&1
    Pop-Location
    $buildErrors = $buildOut | Where-Object { $_ -match "^error" }
    if ($buildErrors) { $buildErrors | ForEach-Object { Write-Fail $_ } }
    if (-not (Test-Path $releaseDesktop)) {
        Write-Fail "App build failed. Make sure Node.js and pnpm are installed."
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-OK "App built"
}

taskkill /F /IM "buddy-desktop.exe" 2>$null | Out-Null; $LASTEXITCODE = 0
Start-Sleep -Milliseconds 300
Start-Process -FilePath $releaseDesktop
Write-OK "buddy-desktop started"

# ─────────────────────────────────────────────
Write-Host ""
Write-Host "  Buddy is running!" -ForegroundColor Magenta
Write-Host "  (this window will close in 3 seconds)" -ForegroundColor DarkGray
Start-Sleep 3

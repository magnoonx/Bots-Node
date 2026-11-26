$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pipPath = Join-Path $scriptDir ".gTTS\Scripts\pip.exe"

if (-not (Test-Path $pipPath)) {
    $pipPath = Join-Path $scriptDir ".gTTS\bin\pip"
}

if (-not (Test-Path $pipPath)) {
    Write-Host "[!] ERROR: No se encontro el entorno Python (.gTTS) en el proyecto." -ForegroundColor Red
    exit 1
}

Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "  INSTALANDO WHISPER LOCAL EN EL ENTORNO PORTABLE (.gTTS)" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "[*] Usando pip: $pipPath" -ForegroundColor Yellow
Write-Host "[*] Instalando 'faster-whisper'..." -ForegroundColor Green

& $pipPath install faster-whisper

Write-Host ""
Write-Host "==============================================================" -ForegroundColor Green
Write-Host "  [OK] faster-whisper instalado exitosamente." -ForegroundColor Green
Write-Host "  Los modelos se guardaran localmente en models/whisper/" -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Green

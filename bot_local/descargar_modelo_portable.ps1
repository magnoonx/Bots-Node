param(
    [string]$Model = "llama3.1:8b"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$modelsDir = Join-Path $scriptDir "models\ollama"

# Configurar variable de entorno para que se guarden en la carpeta local
$env:OLLAMA_MODELS = $modelsDir

Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "  DESCARGA DE MODELO PORTABLE (EDDIA BOT)" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "[*] Destino local: $modelsDir" -ForegroundColor Yellow

if (-not (Test-Path $modelsDir)) {
    New-Item -ItemType Directory -Path $modelsDir -Force | Out-Null
}

$ollamaExe = $null
$cmd = Get-Command ollama -ErrorAction SilentlyContinue
if ($cmd) {
    $ollamaExe = "ollama"
} else {
    $defaultPath = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
    if (Test-Path $defaultPath) {
        $ollamaExe = $defaultPath
    }
}

if (-not $ollamaExe) {
    Write-Host "[!] ERROR: Ollama no esta instalado en el sistema." -ForegroundColor Red
    Write-Host "Descargalo e instalalo desde: https://ollama.com/download/windows" -ForegroundColor Yellow
    exit 1
}

Write-Host "[*] Descargando modelo '$Model' en la carpeta local del proyecto..." -ForegroundColor Green
Write-Host "[*] Por favor espera..." -ForegroundColor Gray

& $ollamaExe pull $Model

Write-Host ""
Write-Host "[OK] Modelo '$Model' descargado exitosamente en $modelsDir" -ForegroundColor Green

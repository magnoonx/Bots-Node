$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$modelsDir = Join-Path $scriptDir "models\ollama"

# Configurar variable de entorno para que lea de la carpeta local
$env:OLLAMA_MODELS = $modelsDir

Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "  INICIANDO MOTOR DE IA LOCAL PORTABLE (EDDIA BOT)" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "[*] Modelos locales en: $modelsDir" -ForegroundColor Yellow

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

Write-Host "[*] Servidor iniciado en http://127.0.0.1:11434" -ForegroundColor Green
Write-Host "[*] Presiona Ctrl+C para detener." -ForegroundColor Gray
Write-Host ""

& $ollamaExe serve

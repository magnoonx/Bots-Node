@echo off
set "PIP_CMD=%~dp0.gTTS\Scripts\pip.exe"
if not exist "%PIP_CMD%" set "PIP_CMD=%~dp0.gTTS\bin\pip"

if not exist "%PIP_CMD%" (
    echo [ERROR] No se encontro pip en .gTTS
    pause
    exit /b 1
)

echo ==============================================================
echo Instalando faster-whisper en el entorno local .gTTS...
echo ==============================================================
"%PIP_CMD%" install faster-whisper
echo.
echo [OK] Instalacion completada.
pause

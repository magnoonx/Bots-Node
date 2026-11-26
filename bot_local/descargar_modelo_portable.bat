@echo off
set "OLLAMA_MODELS=%~dp0models\ollama"
if not exist "%OLLAMA_MODELS%" mkdir "%OLLAMA_MODELS%"

set "OLLAMA_CMD=ollama"
where ollama >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
        set "OLLAMA_CMD=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
    ) else (
        echo [ERROR] Ollama no esta instalado en el sistema.
        echo Descargalo desde https://ollama.com/download/windows
        pause
        exit /b 1
    )
)

set "MODELO=llama3.1:8b"
if not "%~1"=="" set "MODELO=%~1"

echo ==============================================================
echo Descargando modelo: %MODELO%
echo Carpeta de destino: %OLLAMA_MODELS%
echo ==============================================================
"%OLLAMA_CMD%" pull %MODELO%
echo [OK] Descarga finalizada.
pause

@echo off
setlocal
cd /d "%~dp0"
set "BUNDLED_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
echo Validacion local ficticia. No abrir la PWA instalada ni usar cuentas reales.
echo PC: http://localhost:8765/
echo Xiaomi: misma Wi-Fi; usar la direccion xiaomi indicada a continuacion.
echo Si Windows pregunta, permitir solamente red privada. Cerrar con Ctrl+C.
if exist "%BUNDLED_PYTHON%" (
  "%BUNDLED_PYTHON%" serve.py --lan
) else (
  py -3 serve.py --lan
)
pause

@echo off
chcp 65001 >nul
cd /d "%~dp0"
py -c "import sys" >nul 2>nul
if %errorlevel%==0 (
  py servidor.py
  exit /b
)
python -c "import sys" >nul 2>nul
if %errorlevel%==0 (
  python servidor.py
  exit /b
)
echo Python nao foi encontrado neste computador.
echo Abrindo o sistema diretamente no navegador...
start "" "%~dp0index.html"


@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Poliedro Skills

echo ==========================================
echo       POLIEDRO SKILLS - INICIANDO
echo ==========================================
echo.

py -c "import sys" >nul 2>nul
if %errorlevel%==0 (
    py servidor.py
    goto :fim
)

python -c "import sys" >nul 2>nul
if %errorlevel%==0 (
    python servidor.py
    goto :fim
)

echo Python nao foi encontrado neste computador.
echo O sistema sera aberto diretamente no navegador.
start "" "%~dp0index.html"
echo.
echo Para sincronizacao completa entre Painel e Telao,
echo instale o Python ou utilize outro servidor local.
pause

:fim
endlocal

@echo off
REM Chronell Demo — startet die isolierte Demo-Umgebung (Szenario Nordlicht)
cd /d "%~dp0"
start "" "%~dp0Chronell.exe" --demo

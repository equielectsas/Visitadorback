@echo off
cd /d "%~dp0"
git add -A
git commit --no-verify -m "Fix listado visitas admin GET usuarios middleware"
exit /b %ERRORLEVEL%

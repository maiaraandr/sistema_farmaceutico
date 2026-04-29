@echo off
echo Iniciando sistema...

cd /d "%~dp0"

echo Iniciando backend Django...
cd backend
call venv\Scripts\activate

start "Backend Django" cmd /k "python manage.py runserver"

cd ..

echo Iniciando frontend na porta 5500...
start "Frontend" cmd /k "cd Frontend && python -m http.server 8000"

timeout /t 3 >nul

echo Abrindo sistema...
start http://127.0.0.1:5500/html/inicio.html

echo Sistema rodando!
pause
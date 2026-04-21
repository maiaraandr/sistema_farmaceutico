@echo off
echo Iniciando sistema...

cd backend
call venv\Scripts\activate

start cmd /k python manage.py runserver

cd ..

start cmd /k code .
start http://127.0.0.1:5500/Frontend/html/dashboard.html

echo Sistema rodando!
pause
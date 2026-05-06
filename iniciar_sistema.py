import subprocess
import time
import webbrowser
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR / "backend"
FRONTEND_DIR = BASE_DIR

VENV_PYTHON = BASE_DIR / "venv" / "Scripts" / "python.exe"

backend_log = open(BASE_DIR / "backend_erro.txt", "w", encoding="utf-8")
frontend_log = open(BASE_DIR / "frontend_erro.txt", "w", encoding="utf-8")

print("Verificando caminhos...")

print("BASE_DIR:", BASE_DIR)
print("BACKEND_DIR:", BACKEND_DIR)
print("VENV_PYTHON:", VENV_PYTHON)

if not VENV_PYTHON.exists():
    print("ERRO: python.exe do venv não encontrado.")
    print("Caminho esperado:", VENV_PYTHON)
    input("Pressione Enter para sair...")
    exit()

if not (BACKEND_DIR / "manage.py").exists():
    print("ERRO: manage.py não encontrado.")
    print("Caminho esperado:", BACKEND_DIR / "manage.py")
    input("Pressione Enter para sair...")
    exit()

print("Iniciando backend Django...")

subprocess.Popen(
    [str(VENV_PYTHON), "manage.py", "runserver", "127.0.0.1:8000"],
    cwd=str(BACKEND_DIR),
    stdout=backend_log,
    stderr=backend_log,
)

print("Iniciando frontend...")

subprocess.Popen(
    ["python", "-m", "http.server", "5500"],
    cwd=str(FRONTEND_DIR),
    stdout=frontend_log,
    stderr=frontend_log,
)

time.sleep(5)

print("Abrindo login...")
webbrowser.open("http://127.0.0.1:5500/Frontend/html/index.html")

print("Sistema iniciado.")
print("Se a API não abrir, veja o arquivo backend_erro.txt.")
input("Pressione Enter para fechar esta janela...")
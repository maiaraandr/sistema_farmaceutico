const API_BASE_URL =
  'https://sistemafarmaceutico-production.up.railway.app/api';

const btn = document.getElementById('registerBtn');
const errorDiv = document.getElementById('registerError');
const successDiv = document.getElementById('registerSuccess');
const form = document.getElementById('registerForm');

// ── Proteção: redireciona se não for admin ────────────────────────────────────
(function protegerPagina() {
  const user = getCurrentUser();
  const token = getSessionToken();

  if (!user || !token) {
    window.location.href = '/html/index.html';
    return;
  }

  // Comparação explícita: is_admin deve ser exatamente true
  // Evita que undefined/null seja tratado como falsy e redirecione admin
  if (user.is_admin !== true) {
    window.location.href = '/html/inicio.html';
  }
})();

// ── Lucide icons ──────────────────────────────────────────────────────────────
lucide.createIcons();
document.getElementById('nome').focus();

// ── Helpers de mensagem ───────────────────────────────────────────────────────
function mostrarErro(msg) {
  successDiv.classList.add('hidden');
  errorDiv.textContent = msg;
  errorDiv.classList.remove('hidden');
}

function mostrarSucesso(msg) {
  errorDiv.classList.add('hidden');
  successDiv.textContent = msg;
  successDiv.classList.remove('hidden');
}

// ── Toggle de senha ───────────────────────────────────────────────────────────
function toggleSenha(btnId, inputId) {
  const botao = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  if (!botao || !input) return;

  botao.addEventListener('click', function () {
    const icon = this.querySelector('i');
    if (input.type === 'password') {
      input.type = 'text';
      if (icon) icon.setAttribute('data-lucide', 'eye-off');
    } else {
      input.type = 'password';
      if (icon) icon.setAttribute('data-lucide', 'eye');
    }
    lucide.createIcons();
  });
}

toggleSenha('toggleSenha', 'senha');
toggleSenha('toggleSenhaConfirm', 'senhaConfirm');

// ── Submit ────────────────────────────────────────────────────────────────────
form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const nome = document.getElementById('nome').value.trim();
  const email = document.getElementById('email').value.trim().toLowerCase();
  const telefone = document.getElementById('telefone').value.trim();
  const usuario = document.getElementById('usuario').value.trim();
  const senha = document.getElementById('senha').value;
  const senhaConfirm = document.getElementById('senhaConfirm').value;

  errorDiv.classList.add('hidden');
  successDiv.classList.add('hidden');

  if (!nome) return mostrarErro('Informe o nome completo.');
  if (!email) return mostrarErro('Informe um e-mail válido.');
  if (usuario.length < 4)
    return mostrarErro('O usuário deve ter no mínimo 4 caracteres.');
  if (senha.length < 6)
    return mostrarErro('A senha deve ter no mínimo 6 caracteres.');
  if (senha !== senhaConfirm) return mostrarErro('As senhas não coincidem.');

  btn.disabled = true;
  btn.textContent = 'Cadastrando...';

  try {
    const adminUser = getCurrentUser();

    const resp = await fetch(`${API_BASE_URL}/cadastro/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome,
        email,
        telefone,
        usuario,
        senha,
        admin_id: adminUser?.id,
      }),
    });

    const data = await resp.json();

    if (resp.status === 403) {
      mostrarErro(
        'Acesso negado. Apenas administradores podem cadastrar usuários.'
      );
      btn.disabled = false;
      btn.textContent = 'Cadastrar';
      return;
    }

    if (!resp.ok || !data.sucesso) {
      mostrarErro(data.erro || 'Erro ao cadastrar. Tente novamente.');
      btn.disabled = false;
      btn.textContent = 'Cadastrar';
      return;
    }

    mostrarSucesso(`Usuário "${data.usuario.usuario}" criado com sucesso!`);
    btn.textContent = 'Sucesso!';

    setTimeout(() => {
      form.reset();
      btn.disabled = false;
      btn.textContent = 'Cadastrar';
      successDiv.classList.add('hidden');
    }, 2000);
  } catch (err) {
    mostrarErro('Não foi possível conectar ao servidor.');
    btn.disabled = false;
    btn.textContent = 'Cadastrar';
  }
});

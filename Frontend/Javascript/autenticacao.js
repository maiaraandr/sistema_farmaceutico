const API_AUTH_URL = 'https://gestmed.onrender.com/api';

// ── Sessão ─────────────────────────────────────────────────────────────────────

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('farm_current_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getSessionToken() {
  return localStorage.getItem('farm_session_token');
}

function salvarSessaoUsuario(user) {
  localStorage.setItem('farm_current_user', JSON.stringify(user));
  const token = `token_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  localStorage.setItem('farm_session_token', token);
}

function limparSessaoUsuario() {
  localStorage.removeItem('farm_current_user');
  localStorage.removeItem('farm_session_token');
}

// ── Autenticação ───────────────────────────────────────────────────────────────

function isAuthenticated() {
  const user = getCurrentUser();
  const token = getSessionToken();
  return !!(user && token && user.id);
}

function protectPage() {
  if (!isAuthenticated()) {
    limparSessaoUsuario();
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

function redirectIfAuthenticated() {
  if (isAuthenticated()) {
    window.location.href = 'inicio.html';
    return true;
  }
  return false;
}

function logout() {
  limparSessaoUsuario();
  window.location.href = 'index.html';
}

function preencherNomeUsuario(elementId = 'userName') {
  const el = document.getElementById(elementId);
  if (!el) return;
  const user = getCurrentUser();
  el.textContent = user?.nome || user?.usuario || 'Usuário';
}

// ── Login via API ──────────────────────────────────────────────────────────────

async function loginSistema(usuario, senha) {
  try {
    const resp = await fetch(`${API_AUTH_URL}/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, senha }),
    });

    const data = await resp.json();

    if (!resp.ok || !data.sucesso) {
      return {
        sucesso: false,
        mensagem: data.erro || 'Usuário ou senha inválidos.',
      };
    }

    salvarSessaoUsuario(data.usuario);
    return {
      sucesso: true,
      mensagem: 'Login realizado com sucesso.',
      usuario: data.usuario,
    };
  } catch (err) {
    return {
      sucesso: false,
      mensagem: 'Não foi possível conectar ao servidor.',
    };
  }
}

// ── Verificação de autenticação ────────────────────────────────────────────────

function verificarAutenticacao() {
  if (!isAuthenticated()) {
    window.location.href = '../html/index.html';
  }
}

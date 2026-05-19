const API_AUTH_URL =
  'https://sistemafarmaceutico-production.up.railway.app/api';

// ── Sessão ─────────────────────────────────────────────────────────────────────

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('farm_current_user');
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('Erro ao recuperar usuário da sessão:', error);
    return null;
  }
}

function getSessionToken() {
  return localStorage.getItem('farm_session_token');
}

function salvarSessaoUsuario(user) {
  try {
    localStorage.setItem('farm_current_user', JSON.stringify(user));

    const token = `token_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    localStorage.setItem('farm_session_token', token);
  } catch (error) {
    console.error('Erro ao salvar sessão do usuário:', error);
  }
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
  const element = document.getElementById(elementId);

  if (!element) return;

  const user = getCurrentUser();

  element.textContent = user?.nome || user?.usuario || 'Usuário';
}

// ── Login via API ──────────────────────────────────────────────────────────────

async function loginSistema(usuario, senha) {
  try {
    const response = await fetch(`${API_AUTH_URL}/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        usuario,
        senha,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.sucesso) {
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
  } catch (error) {
    console.error('Erro ao realizar login:', error);

    return {
      sucesso: false,
      mensagem: 'Não foi possível conectar ao servidor.',
    };
  }
}

// ── Verificação de autenticação ────────────────────────────────────────────────

function verificarAutenticacao() {
  if (!isAuthenticated()) {
    limparSessaoUsuario();
    window.location.href = '..index.html';
    return false;
  }

  return true;
}
